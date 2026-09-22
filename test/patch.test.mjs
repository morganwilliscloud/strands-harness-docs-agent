import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'

const script = resolve('scripts/prepare-docs-patch.mjs')
function checkout() {
  const cwd = mkdtempSync(join(tmpdir(), 'docs-patch-'))
  const git = (...args) => execFileSync('git', args, { cwd, stdio: 'pipe' })
  mkdirSync(join(cwd, 'docs'))
  mkdirSync(join(cwd, 'run-output'))
  writeFileSync(join(cwd, 'run-output/agent-summary.md'), 'Updated sample documentation.\n')
  writeFileSync(join(cwd, 'README.md'), '# Sample\n')
  writeFileSync(join(cwd, '.gitignore'), 'run-output/\n')
  writeFileSync(join(cwd, 'package.json'), JSON.stringify({ scripts: { test: 'node -e ""', 'docs:check': 'node -e ""' } }))
  git('init', '-b', 'main')
  git('add', '.')
  git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'initial')
  return cwd
}
function run(cwd) {
  const env = { ...process.env }
  delete env.GITHUB_OUTPUT
  return spawnSync(process.execPath, [script], { cwd, env, encoding: 'utf8' })
}
test('a documentation-only edit produces a patch after independent checks', () => {
  const cwd = checkout()
  try {
    writeFileSync(join(cwd, 'README.md'), '# Updated sample\n')
    const result = run(cwd)
    assert.equal(result.status, 0, result.stderr)
    assert.match(readFileSync(join(cwd, 'run-output/docs.patch'), 'utf8'), /Updated sample/)
  } finally { rmSync(cwd, { recursive: true, force: true }) }
})
test('non-document changes and symlink documentation are rejected', () => {
  const cwd = checkout()
  try {
    writeFileSync(join(cwd, 'source.js'), 'console.log("unexpected")')
    assert.match(run(cwd).stderr, /forbidden path/)
    rmSync(join(cwd, 'source.js'))
    symlinkSync('../package.json', join(cwd, 'docs/package.md'))
    assert.match(run(cwd).stderr, /Invalid documentation file/)
  } finally { rmSync(cwd, { recursive: true, force: true }) }
})

test('missing, empty or symlinked agent summaries cannot be published', () => {
  const cwd = checkout()
  const summary = join(cwd, 'run-output/agent-summary.md')
  try {
    rmSync(summary)
    assert.match(run(cwd).stderr, /Agent must write a nonempty regular file/)
    writeFileSync(summary, '   ')
    assert.match(run(cwd).stderr, /Agent must write a nonempty regular file/)
    rmSync(summary)
    symlinkSync('../package.json', summary)
    assert.match(run(cwd).stderr, /Agent must write a nonempty regular file/)
  } finally { rmSync(cwd, { recursive: true, force: true }) }
})
