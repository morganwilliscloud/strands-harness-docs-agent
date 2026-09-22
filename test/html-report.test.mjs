import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { renderHtmlReport } from '../bin/html-report.mjs'
import { summarize } from '../bin/request-report.mjs'

test('HTML export reports the same fixture as text and JSON, with all requests inspectable', () => {
  const html = execFileSync(process.execPath, ['bin/request-report.mjs', 'fixtures/requests.jsonl', '--format', 'html'], { encoding: 'utf8' })
  assert.match(html, /^<!doctype html>/)
  assert.match(html, /2 server errors to investigate/)
  assert.match(html, /25\.0% returned a 5xx status/)
  assert.match(html, /240<small>ms<\/small>/)
  assert.equal((html.match(/<tr data-index=/g) || []).length, 8)
  assert.equal((html.match(/data-status="5\d\d"/g) || []).length, 2)
  assert.doesNotMatch(html, /<(?:script|link)[^>]+(?:src|href)=/i)
})

test('log paths and filenames are rendered as text, never executable markup', () => {
  const path = '<img src=x onerror=alert(1)>'
  const rows = [{ path, status: 503, durationMs: 10 }]
  const report = summarize(JSON.stringify(rows[0]))
  const html = renderHtmlReport(rows, report, 'evil<img onerror=alert(2)>.jsonl')
  assert.doesNotMatch(html, /<img/)
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/)
  assert.match(html, /evil&lt;img onerror=alert\(2\)&gt;\.jsonl/)
  assert.equal((html.match(/<script>/g) || []).length, 1)
})

test('zero-duration requests produce a valid report without invalid chart scales', () => {
  const rows = [{ path: '/', status: 200, durationMs: 0 }]
  const html = renderHtmlReport(rows, summarize(JSON.stringify(rows[0])), 'zero.jsonl')
  assert.match(html, /No server errors in this log/)
  assert.match(html, /Peak 0 ms/)
  assert.doesNotMatch(html, /NaN|Infinity/)
})
