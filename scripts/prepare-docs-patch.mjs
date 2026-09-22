import { execFileSync } from 'node:child_process'
import { lstatSync, realpathSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs'
import { resolve, sep } from 'node:path'

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' })
const allowed = path => path === 'README.md' || /^docs\/[\w./-]+\.md$/.test(path)
const paths = new Set([
  ...git('diff', '--name-only', 'HEAD', '-z').split('\0'),
  ...git('ls-files', '--others', '--exclude-standard', '-z').split('\0'),
].filter(Boolean))
for (const path of paths) {
  if (!allowed(path)) throw new Error(`Agent changed a forbidden path: ${path}`)
  const stat = lstatSync(path)
  if (!stat.isFile() || stat.size > 256_000 || stat.mode & 0o111) throw new Error(`Invalid documentation file: ${path}`)
  if (!realpathSync(path).startsWith(resolve('.') + sep)) throw new Error(`File escapes checkout: ${path}`)
  if (readFileSync(path).includes(0)) throw new Error(`Binary content in documentation: ${path}`)
}
const summaryPath = 'run-output/agent-summary.md'
let summary
try {
  const stat = lstatSync(summaryPath)
  if (!stat.isFile() || stat.size > 256_000 || stat.mode & 0o111 ||
      !realpathSync(summaryPath).startsWith(resolve('run-output') + sep)) throw new Error('Invalid file')
  summary = readFileSync(summaryPath, 'utf8')
  if (!summary.trim() || summary.includes('\0')) throw new Error('Empty or binary summary')
} catch {
  throw new Error('Agent must write a nonempty regular file at run-output/agent-summary.md before publishing')
}
mkdirSync('run-output', { recursive: true })
for (const script of ['test', 'docs:check']) {
  const output = execFileSync('npm', ['run', script], { encoding: 'utf8', timeout: 120_000 })
  writeFileSync(`run-output/${script.replace(':', '-')}.txt`, output)
  process.stdout.write(output)
}
git('add', '--', 'README.md', 'docs')
const patch = git('diff', '--cached', '--binary')
writeFileSync('run-output/docs.patch', patch)
writeFileSync('run-output/changed-files.json', JSON.stringify([...paths], null, 2) + '\n')
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `changed=${Boolean(patch)}\n`)
const source = process.env.HEAD_SHA || git('rev-parse', 'HEAD').trim()
writeFileSync('run-output/pr-body.md', `Documentation update for ${source}.\n\n${summary}\n\n` +
  'Validation run independently after the agent finished:\n- `npm test`\n- `npm run docs:check`\n' +
  '\nOnly README.md and Markdown files under docs/ are included. Please review before merging.\n')
console.log(patch ? 'Verified documentation patch prepared.' : 'No patch to publish.')
