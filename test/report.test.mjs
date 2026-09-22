import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { summarize } from '../bin/request-report.mjs'

test('summarizes requests, server errors and nearest-rank p95', () => {
  assert.deepEqual(summarize('{"path":"/a","status":200,"durationMs":10}\n{"path":"/a","status":503,"durationMs":50}\n'), {
    requests: 2, errors: 1, p95Ms: 50, routes: { '/a': 2 },
  })
})
test('rejects empty and malformed input with actionable errors', () => {
  assert.throws(() => summarize(''), /no requests/)
  assert.throws(() => summarize('oops'), /Line 1: invalid JSON/)
  assert.throws(() => summarize('{"path":"/","status":200,"durationMs":-1}'), /nonnegative/)
})
test('the CLI reports the fixture and rejects invalid arguments', () => {
  const output = execFileSync(process.execPath, ['bin/request-report.mjs', 'fixtures/requests.jsonl'], { encoding: 'utf8' })
  assert.match(output, /Requests: 8/)
  assert.match(output, /Server errors: 2/)
  assert.match(output, /p95 latency: 240 ms/)
  assert.equal(spawnSync(process.execPath, ['bin/request-report.mjs', '--unknown']).status, 1)
})
test('JSON output has the same results and text remains the default', () => {
  const cli = args => execFileSync(process.execPath, ['bin/request-report.mjs', 'fixtures/requests.jsonl', ...args], { encoding: 'utf8' })
  assert.deepEqual(JSON.parse(cli(['--format', 'json'])), {
    requests: 8, errors: 2, p95Ms: 240, routes: { '/': 3, '/api/search': 3, '/api/export': 2 },
  })
  assert.equal(cli([]), cli(['--format', 'text']))
})
test('unsupported output formats are rejected rather than silently accepted', () => {
  const result = spawnSync(process.execPath, ['bin/request-report.mjs', 'fixtures/requests.jsonl', '--format', 'yaml'], { encoding: 'utf8' })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /Expected --format text or --format json/)
})
