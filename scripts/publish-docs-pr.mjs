import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()
const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8' }).trim()
const sha = process.env.SOURCE_SHA
const repo = process.env.GITHUB_REPOSITORY
if (!sha || !/^[a-f0-9]{40}$/.test(sha) || !repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
  throw new Error('SOURCE_SHA and GITHUB_REPOSITORY are required')
}
const revision = Number(process.env.DOCS_PR_NUMBER || 0)
const branch = revision ? process.env.DOCS_PR_BRANCH : `docs/update-${sha.slice(0, 12)}`
if (revision) {
  if (!/^docs\/update-[a-f0-9]{12}$/.test(branch ?? '') || !/^[a-f0-9]{40}$/.test(process.env.DOCS_PR_HEAD ?? '')) throw new Error('Invalid revision target')
  const pr = JSON.parse(gh('api', `repos/${repo}/pulls/${revision}`))
  if (pr.state !== 'open' || pr.head.repo?.full_name !== repo || pr.head.ref !== branch ||
      pr.head.sha !== process.env.DOCS_PR_HEAD || pr.user.login !== 'github-actions[bot]') throw new Error('PR changed while the agent worked; refusing to overwrite')
  git('fetch', 'origin', branch)
  if (git('rev-parse', 'FETCH_HEAD') !== process.env.DOCS_PR_HEAD) throw new Error('Branch changed while publishing')
  git('switch', '-c', branch, 'FETCH_HEAD')
  if (!readFileSync('docs-output/docs.patch', 'utf8').trim()) {
    console.log(gh('pr', 'comment', String(revision), '--repo', repo, '--body-file', 'docs-output/pr-body.md'))
    process.exit(0)
  }
}
const existing = JSON.parse(gh('pr', 'list', '--repo', repo, '--head', branch, '--state', 'all', '--json', 'url'))
if (!revision && existing.length) {
  console.log(`A documentation PR already exists: ${existing[0].url}`)
  process.exit(0)
}
if (!revision && git('rev-parse', 'HEAD') !== sha) throw new Error('Publisher checkout does not match source commit')
if (!revision) git('switch', '-c', branch)
git('apply', '--index', 'docs-output/docs.patch')
const files = git('diff', '--cached', '--name-only').split('\n').filter(Boolean)
if (!files.length || files.some(path => path !== 'README.md' && !/^docs\/[\w./-]+\.md$/.test(path))) {
  throw new Error('Patch contains paths outside the documentation allowlist')
}
const changes = git('diff', '--cached', '--raw').split('\n')
if (changes.some(line => !/^:(?:000000|100644) 100644 /.test(line))) {
  throw new Error('Patch must contain regular non-executable Markdown files')
}
git('-c', 'user.name=github-actions[bot]', '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com',
  '-c', 'core.hooksPath=/dev/null', 'commit', '-m', `docs: update usage for ${sha.slice(0, 7)}`)
if (revision) {
  git('push', 'origin', `HEAD:refs/heads/${branch}`)
  console.log(gh('pr', 'comment', String(revision), '--repo', repo, '--body-file', 'docs-output/pr-body.md'))
  process.exit(0)
}
const remote = git('ls-remote', '--heads', 'origin', branch)
if (remote) {
  git('fetch', 'origin', branch)
  if (git('rev-parse', 'FETCH_HEAD^{tree}') !== git('rev-parse', 'HEAD^{tree}')) {
    throw new Error(`Remote ${branch} exists with different content; refusing to overwrite it`)
  }
} else {
  git('push', '--set-upstream', 'origin', branch)
}
console.log(gh('pr', 'create', '--repo', repo, '--base', 'main', '--head', branch,
  '--title', `docs: update usage for ${sha.slice(0, 7)}`, '--body-file', 'docs-output/pr-body.md'))
