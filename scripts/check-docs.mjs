import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

function markdown(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? markdown(path) : path.endsWith('.md') ? [path] : []
  })
}
let count = 0
for (const file of ['README.md', ...markdown('docs')]) {
  const text = readFileSync(file, 'utf8')
  for (const block of text.matchAll(/```sh verify\r?\n([\s\S]*?)```/g)) {
    for (const line of block[1].split('\n').map(x => x.trim()).filter(Boolean)) {
      const args = line.split(/\s+/)
      if (args[0] !== 'node' || args[1] !== 'bin/request-report.mjs'
        || args.some(x => !/^[\w./=-]+$/.test(x))) throw new Error(`${file}: unsupported verified command: ${line}`)
      const output = execFileSync(process.execPath, args.slice(1), { encoding: 'utf8', timeout: 10_000 })
      console.log(`${file}: ${line}\n${output.trim()}\n`)
      count++
    }
  }
  for (const link of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = link[1].split('#')[0]
    if (!target || /^[a-z]+:/i.test(target)) continue
    if (!existsSync(resolve(dirname(file), target))) throw new Error(`${file}: broken local link ${target}`)
  }
}
if (!count) throw new Error('No executable documentation examples found')
console.log(`Verified ${count} documentation commands and checked local file links.`)
