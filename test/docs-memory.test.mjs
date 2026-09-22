import test from 'node:test'
import assert from 'node:assert/strict'
import { selectRun, freshFeedback, permitted } from '../scripts/docs-memory.mjs'

test('memory restores only previous successful main runs, newest first', () => {
  const run = { conclusion: 'success', head_branch: 'main', event: 'push', created_at: '2026-09-18T00:00:00Z' }
  assert.deepEqual(selectRun([
    { ...run, id: 1 }, { ...run, id: 2, created_at: '2026-09-18T01:00:00Z' },
    { ...run, id: 3, conclusion: 'failure' }, { ...run, id: 4, head_branch: 'untrusted' },
    { ...run, id: 5, event: 'pull_request' }, { ...run, id: 6 },
  ], '6').map(r => r.id), [2, 1])
})
test('feedback excludes bots, blank bodies and previously consumed comments', () => {
  const item = { node_id: 'a', body: 'Prefer runnable examples', user: { type: 'User' } }
  assert.deepEqual(freshFeedback([item, { ...item, node_id: 'b' },
    { ...item, node_id: 'c', body: '' }, { ...item, node_id: 'd', user: { type: 'Bot' } }], new Set(['a'])), [{ ...item, node_id: 'b' }])
})
test('only current repository writers can supply learned review preferences', () => {
  for (const p of ['admin', 'maintain', 'write']) assert.equal(permitted(p), true)
  for (const p of ['read', 'triage', 'none', undefined]) assert.equal(permitted(p), false)
})
