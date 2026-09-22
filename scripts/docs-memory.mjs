import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile, readdir, copyFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 20_000_000 })
const api = route => JSON.parse(gh('api', route))
const pages = route => JSON.parse(gh('api', '--paginate', '--slurp', route)).flat()
export const permitted = permission => ['admin', 'maintain', 'write'].includes(permission)
export function selectRun(runs, current) {
  return runs.filter(r => String(r.id) !== String(current) && r.conclusion === 'success' &&
    r.head_branch === 'main' && ['push', 'workflow_dispatch', 'issue_comment'].includes(r.event))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
}
export function freshFeedback(items, seen) {
  return items.filter(c => c.body?.trim() && c.user?.type !== 'Bot' && !seen.has(c.node_id))
}
async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, 'utf8')) }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error }
}
async function copyMemories(from, to) {
  await mkdir(to, { recursive: true })
  let files
  try { files = await readdir(from, { withFileTypes: true }) }
  catch (error) { if (error.code === 'ENOENT') return 0; throw error }
  let count = 0
  for (const file of files) {
    if (!file.isFile() || !file.name.endsWith('.md')) continue
    await copyFile(join(from, file.name), join(to, file.name)); count++
  }
  return count
}
async function restore(repo) {
  const batches = pages(`repos/${repo}/actions/workflows/docs.yml/runs?branch=main&status=success&per_page=100`)
  // Paginated workflow responses are objects, not arrays.
  const runs = batches.flatMap(page => page.workflow_runs ?? [])
  let restored = { sourceRun: null, memoryFiles: 0, seen: [] }
  for (const run of selectRun(runs, process.env.GITHUB_RUN_ID)) {
    const artifacts = api(`repos/${repo}/actions/runs/${run.id}/artifacts?per_page=100`).artifacts
    const artifact = artifacts.filter(a => !a.expired && a.name.startsWith('docs-memory-'))
      .sort((a,b) => b.id-a.id)[0]
    if (!artifact) continue
    const temp = await mkdtemp(join(tmpdir(), 'docs-memory-'))
    try {
      gh('run', 'download', String(run.id), '--repo', repo, '--name', artifact.name, '--dir', temp)
      const count = await copyMemories(join(temp, 'memory'), '.agent/memory')
      const cursor = await readJson(join(temp, 'feedback-cursor.json'), { seen: [] })
      restored = { sourceRun: run.id, memoryFiles: count, seen: cursor.seen }
      break
    } finally { await rm(temp, { recursive: true, force: true }) }
  }
  await mkdir('run-output', { recursive: true })
  await writeFile('run-output/memory-restored.json', JSON.stringify(restored, null, 2)+'\n')
  console.log(`Restored ${restored.memoryFiles} memory files from run ${restored.sourceRun ?? 'none (fresh start)'}.`)
}
async function feedback(repo) {
  const restored = await readJson('run-output/memory-restored.json', { seen: [] })
  const seen = new Set(restored.seen), permissionCache = new Map(), collected = []
  const pulls = pages(`repos/${repo}/pulls?state=all&per_page=100`)
  for (const pr of pulls) {
    if (pr.head.repo?.full_name !== repo || !pr.head.ref.startsWith('docs/update-') ||
        !['Bot'].includes(pr.user.type) || pr.user.login !== 'github-actions[bot]') continue
    const comments = [
      ...pages(`repos/${repo}/issues/${pr.number}/comments?per_page=100`),
      ...pages(`repos/${repo}/pulls/${pr.number}/reviews?per_page=100`),
      ...pages(`repos/${repo}/pulls/${pr.number}/comments?per_page=100`),
    ]
    for (const comment of freshFeedback(comments, seen)) {
      const login = comment.user.login
      if (!permissionCache.has(login)) permissionCache.set(login,
        permitted(api(`repos/${repo}/collaborators/${encodeURIComponent(login)}/permission`).permission))
      if (!permissionCache.get(login)) continue
      collected.push({ pr: pr.number, author: login, url: comment.html_url,
        body: comment.body, nodeId: comment.node_id })
      seen.add(comment.node_id)
    }
  }
  await writeFile('run-output/reviewer-feedback.json', JSON.stringify(collected, null, 2)+'\n')
  await writeFile('run-output/feedback-cursor.json', JSON.stringify({ seen: [...seen] }, null, 2)+'\n')
  console.log(`Collected ${collected.length} new comments from authorized reviewers.`)
}
async function save() {
  await mkdir('run-output/memory-snapshot', { recursive: true })
  const count = await copyMemories('.agent/memory', 'run-output/memory-snapshot/memory')
  await copyFile('run-output/feedback-cursor.json', 'run-output/memory-snapshot/feedback-cursor.json')
  console.log(`Saved ${count} memory files for the next run.`)
}
export async function main(mode) {
  const repo = process.env.GITHUB_REPOSITORY
  if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error('GITHUB_REPOSITORY is required')
  if (mode === 'restore') await restore(repo)
  else if (mode === 'feedback') await feedback(repo)
  else if (mode === 'save') await save()
  else throw new Error('Use restore, feedback, or save')
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main(process.argv[2])
