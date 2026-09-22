import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { renderHtmlReport } from './html-report.mjs'

function parseRequests(text) {
  const rows = text.trim().split('\n').filter(Boolean).map((line, index) => {
    let row
    try { row = JSON.parse(line) } catch { throw new Error(`Line ${index + 1}: invalid JSON`) }
    if (!Number.isInteger(row.status) || row.status < 100 || row.status > 599
      || !Number.isFinite(row.durationMs) || row.durationMs < 0 || typeof row.path !== 'string') {
      throw new Error(`Line ${index + 1}: expected path, HTTP status, and nonnegative durationMs`)
    }
    return row
  })
  if (!rows.length) throw new Error('The log contains no requests')
  return rows
}

export function summarize(text) {
  return summarizeRows(parseRequests(text))
}

function summarizeRows(rows) {
  const latencies = rows.map(row => row.durationMs).sort((a, b) => a - b)
  const routes = {}
  for (const row of rows) routes[row.path] = (routes[row.path] || 0) + 1
  return {
    requests: rows.length,
    errors: rows.filter(row => row.status >= 500).length,
    p95Ms: latencies[Math.ceil(rows.length * 0.95) - 1],
    routes,
  }
}

export function main(args) {
  if (args.length === 1 && args[0] === '--help') {
    console.log('Usage: node bin/request-report.mjs <requests.jsonl> [--format text|json|html]')
    console.log('Print request count, server errors, p95 latency, and route counts.')
    console.log('Output defaults to text. Use --format json for machine-readable output.')
    console.log('Use --format html > report.html for an interactive browser report.')
    return
  }
  if (![1, 3].includes(args.length) || args[0].startsWith('-')) {
    throw new Error('Provide a JSONL file and optional --format text|json|html. Use --help for usage.')
  }
  const format = args.length === 3 ? args[2] : 'text'
  if ((args.length === 3 && args[1] !== '--format') || !['text', 'json', 'html'].includes(format)) {
    throw new Error('Expected --format text or --format json or --format html')
  }
  const rows = parseRequests(readFileSync(args[0], 'utf8'))
  const report = summarizeRows(rows)
  if (format === 'html') {
    console.log(renderHtmlReport(rows, report, args[0]))
    return
  }
  if (format === 'json') {
    console.log(JSON.stringify(report, null, 2))
    return
  }
  console.log(`Requests: ${report.requests}`)
  console.log(`Server errors: ${report.errors}`)
  console.log(`p95 latency: ${report.p95Ms} ms`)
  for (const [path, count] of Object.entries(report.routes)) console.log(`${path}: ${count}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(process.argv.slice(2)) }
  catch (error) { console.error(error.message); process.exitCode = 1 }
}
