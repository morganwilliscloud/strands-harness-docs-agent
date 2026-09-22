import { execFileSync } from 'node:child_process'
import { appendFile, mkdir, readFile, writeFile, readdir, cp, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { permitted, selectRun } from './docs-memory.mjs'
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()
const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 20_000_000 })
const api = route => JSON.parse(gh('api', route))
export const docPath = p => p === 'README.md' || /^docs\/[\w./-]+\.md$/.test(p)
export function validatePr(pr, repo) {
  if (pr.state !== 'open' || pr.head.repo?.full_name !== repo || pr.base.ref !== 'main' ||
      pr.user.login !== 'github-actions[bot]' || !/^docs\/update-[a-f0-9]{12}$/.test(pr.head.ref)) {
    throw new Error('Revisions require an open docs-bot PR in this repository targeting main')
  }
}
export function parseRevision(event, eventName) {
  if (eventName === 'issue_comment') {
    if (!event.issue?.pull_request || !/^@docs-bot\s+revise\b/i.test(event.comment?.body ?? '')) throw new Error('Not a revision command')
    return { number: event.issue.number, feedback: event.comment.body.replace(/^@docs-bot\s+revise\b\s*/i, '').trim() }
  }
  return { number: Number(event.inputs?.pr_number) || 0, feedback: event.inputs?.feedback?.trim() ?? '' }
}
async function output(key, value) {
  if (process.env.GITHUB_ENV) await appendFile(process.env.GITHUB_ENV, `${key}=${value}\n`)
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `${key}=${value}\n`)
}
async function restoreSession(repo, sourceSha) {
  const pages = JSON.parse(gh('api', '--paginate', '--slurp', `repos/${repo}/actions/workflows/docs.yml/runs?branch=main&status=success&per_page=100`))
  const runs = selectRun(pages.flatMap(p => p.workflow_runs), process.env.GITHUB_RUN_ID)
  for (const run of runs) {
    const artifacts = api(`repos/${repo}/actions/runs/${run.id}/artifacts?per_page=100`).artifacts
    const artifact = artifacts.filter(a => !a.expired && a.name.startsWith(`docs-session-${sourceSha}-`)).sort((a,b) => b.id-a.id)[0]
    if (!artifact) continue
    const temp = await mkdtemp(join(tmpdir(), 'docs-session-'))
    try {
      gh('run', 'download', String(run.id), '--repo', repo, '--name', artifact.name, '--dir', temp)
      const source = join(temp, 'sessions')
      const ids = (await readdir(source, { withFileTypes: true })).filter(d => d.isDirectory() && d.name !== 'offloaded').map(d => d.name)
      const state = JSON.parse(await readFile(join(temp, 'session-state.json'), 'utf8'))
      const sessionId = state.sessionId
      if (!sessionId || !/^[\w-]+$/.test(sessionId) || !ids.includes(sessionId)) throw new Error('Cannot identify the original session')
      const snapshot = JSON.parse(await readFile(join(source, sessionId, 'scopes/agent/agent/snapshots/snapshot_latest.json'), 'utf8'))
      const priorMessages = snapshot.data.messages.length
      if (!priorMessages) throw new Error('Saved session has no conversation to resume')
      await mkdir('.agent', { recursive: true }); await cp(source, '.agent/sessions', { recursive: true })
      return { sessionId, sourceRun: run.id, priorMessages }
    } finally { await rm(temp, { recursive: true, force: true }) }
  }
  throw new Error('No retained session found for this PR. Refusing to silently start a new conversation.')
}
async function prepare() {
  const repo = process.env.GITHUB_REPOSITORY
  const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8'))
  const revision = parseRevision(event, process.env.GITHUB_EVENT_NAME)
  await mkdir('run-output', { recursive: true })
  if (!revision.number) {
    if (process.env.GITHUB_EVENT_NAME === 'workflow_dispatch' && !event.inputs?.base_sha) throw new Error('Supply base_sha or pr_number')
    const sourceSha = git('rev-parse', 'HEAD')
    const state = { sessionId: `docs-${sourceSha.slice(0,12)}`, sourceSha, prNumber: 0, priorMessages: 0 }
    await writeFile('run-output/session-state.json', JSON.stringify(state, null, 2)+'\n')
    await output('DOCS_SESSION_ID', state.sessionId); await output('DOCS_SOURCE_SHA', sourceSha)
    await output('DOCS_PR_NUMBER', '0'); return
  }
  if (!revision.feedback) throw new Error('Include revision instructions after @docs-bot revise')
  const login = event.sender.login
  if (!permitted(api(`repos/${repo}/collaborators/${encodeURIComponent(login)}/permission`).permission)) throw new Error('Only repository writers can request revisions')
  const pr = api(`repos/${repo}/pulls/${revision.number}`); validatePr(pr, repo)
  const sourceSha = git('rev-parse', `${pr.head.ref.split('-').at(-1)}^{commit}`)
  git('merge-base', '--is-ancestor', sourceSha, 'HEAD')
  git('-c', 'credential.helper=', '-c', 'credential.helper=!gh auth git-credential',
    'fetch', 'origin', `refs/pull/${pr.number}/head`)
  if (git('rev-parse', 'FETCH_HEAD') !== pr.head.sha) throw new Error('PR changed during preparation; retry')
  const changed = git('diff', '--name-only', sourceSha, pr.head.sha).split('\n').filter(Boolean)
  if (changed.some(p => !docPath(p))) throw new Error('PR contains changes outside the documentation allowlist')
  // Execute the trusted main-branch agent/workflow. Only overlay PR documentation.
  for (const path of changed) {
    if (!git('ls-tree', pr.head.sha, '--', path).startsWith('100644 blob ')) throw new Error('PR docs must be regular files')
    const body = execFileSync('git', ['show', `${pr.head.sha}:${path}`])
    if (body.length > 256_000 || body.includes(0)) throw new Error('Invalid documentation content')
    await mkdir(join(path, '..'), { recursive: true }); await writeFile(path, body)
  }
  git('add', '--', 'README.md', 'docs')
  if (git('diff', '--cached', '--name-only')) git('-c','user.name=docs-bot','-c','user.email=docs-bot@localhost', '-c','core.hooksPath=/dev/null','commit','-m','Local documentation baseline for PR revision')
  const restored = await restoreSession(repo, sourceSha)
  const state = { ...restored, sourceSha, prNumber: pr.number, prHead: pr.head.sha, prBranch: pr.head.ref }
  await writeFile('run-output/session-state.json', JSON.stringify(state, null, 2)+'\n')
  await writeFile('run-output/revision-request.json', JSON.stringify({ ...revision, author: login }, null, 2)+'\n')
  for (const [key,value] of Object.entries({DOCS_SESSION_ID:state.sessionId,DOCS_SOURCE_SHA:sourceSha,DOCS_PR_NUMBER:pr.number,DOCS_PR_HEAD:pr.head.sha,DOCS_PR_BRANCH:pr.head.ref})) await output(key,String(value))
  console.log(`Resuming PR #${pr.number}: session ${state.sessionId}, ${state.priorMessages} prior messages, saved by run ${state.sourceRun}.`)
}
async function save() {
  const state = JSON.parse(await readFile('run-output/session-state.json', 'utf8'))
  const snapshot = JSON.parse(await readFile(`.agent/sessions/${state.sessionId}/scopes/agent/agent/snapshots/snapshot_latest.json`, 'utf8'))
  state.savedMessages = snapshot.data.messages.length
  await mkdir('run-output/session-snapshot', { recursive: true })
  await cp('.agent/sessions', 'run-output/session-snapshot/sessions', { recursive: true })
  await writeFile('run-output/session-snapshot/session-state.json', JSON.stringify(state, null, 2)+'\n')
  console.log(`Saved session ${state.sessionId}: ${state.priorMessages} prior messages, ${state.savedMessages} messages after this run.`)
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv[2] === 'prepare') await prepare()
  else if (process.argv[2] === 'save') await save()
  else throw new Error('Use prepare or save')
}
