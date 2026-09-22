// Runs the published factory and file persistence with deterministic model responses.
// No provider credentials, network model calls, or generated code execution.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, readdir, cp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { Model } from '@strands-agents/sdk'
import { createHarness } from '@strands-agents/harness'

class FixtureModel extends Model {
  calls = []
  getConfig() { return { modelId: 'fixture', maxTokens: 1000 } }
  updateConfig() {}
  async *stream(messages, options) {
    this.calls.push(JSON.parse(JSON.stringify({ messages, options })))
    const extraction = String(options?.systemPrompt).includes('extract durable facts')
    const text = extraction
      ? '[{"content":"Put runnable examples before option tables."}]'
      : 'Documentation review complete.'
    yield { type: 'modelMessageStartEvent', role: 'assistant' }
    yield { type: 'modelContentBlockStartEvent' }
    yield { type: 'modelContentBlockDeltaEvent', delta: { type: 'textDelta', text } }
    yield { type: 'modelContentBlockStopEvent' }
    yield { type: 'modelMessageStopEvent', stopReason: 'endTurn' }
  }
}

test('published factory saves resumable history and carries memory into a different session', async () => {
  const root = await mkdtemp(join(tmpdir(), 'docs-persistence-'))
  const originalCwd = process.cwd()
  const skillDirectory = resolve('.agent/skills')
  const saveScript = resolve('scripts/docs-session.mjs')
  try {
    const firstRunner = join(root, 'first')
    await mkdir(firstRunner)
    await cp(skillDirectory, join(firstRunner, '.agent/skills'), { recursive: true })
    process.chdir(firstRunner)
    const model = new FixtureModel()
    const first = await createHarness({ model, session: { id: 'docs-first' } })
    assert.equal((await first.invoke('For documentation, put runnable examples before option tables.')).stopReason, 'endTurn')
    assert.match(JSON.stringify(model.calls[0].options), /docs-maintainer/,
      'the published factory discovers the copied skills without registration')
    await first.memoryManager.flush()
    const memoryFiles = (await readdir('.agent/memory')).filter(f => f.endsWith('.md'))
    assert.ok(memoryFiles.length > 0, 'flush persists extracted Markdown')

    await mkdir('run-output')
    await writeFile('run-output/session-state.json', JSON.stringify({
      sessionId: 'docs-first', sourceSha: 'a'.repeat(40), prNumber: 0, priorMessages: 0,
    }))
    execFileSync(process.execPath, [saveScript, 'save'], { stdio: 'pipe' })
    const state = JSON.parse(await readFile('run-output/session-snapshot/session-state.json', 'utf8'))
    assert.ok(state.savedMessages >= 2)

    // A fresh runner receives the session artifact and the separate shared memory files.
    const nextRunner = join(root, 'next')
    await mkdir(join(nextRunner, '.agent'), { recursive: true })
    await cp('run-output/session-snapshot/sessions', join(nextRunner, '.agent/sessions'), { recursive: true })
    await cp('.agent/memory', join(nextRunner, '.agent/memory'), { recursive: true })
    process.chdir(nextRunner)
    const revisionModel = new FixtureModel()
    const revision = await createHarness({ model: revisionModel, session: { id: 'docs-first' } })
    await revision.invoke('Add troubleshooting to that documentation.')
    await revision.memoryManager.flush()
    assert.ok(revisionModel.calls.some(call =>
      call.messages.filter(m => m.role === 'user').length >= 2 &&
      JSON.stringify(call.messages).includes('For documentation, put runnable examples before option tables.')),
    'revision sees the original conversation')

    const newModel = new FixtureModel()
    const nextJob = await createHarness({ model: newModel, session: { id: 'docs-second' } })
    await nextJob.invoke('Write documentation examples and option tables.')
    await nextJob.memoryManager.flush()
    const normalCall = newModel.calls.find(call => !String(call.options?.systemPrompt).includes('extract durable facts'))
    assert.equal(normalCall.messages.filter(m => m.role === 'user').length, 1,
      'a new job does not inherit the previous session messages')
    assert.match(JSON.stringify(normalCall), /Put runnable examples before option tables/,
      'a new session can retrieve the shared preference')
  } finally {
    process.chdir(originalCwd)
    await rm(root, { recursive: true, force: true })
  }
})
