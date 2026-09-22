import { createHarness } from '@strands-agents/harness'
import { getTask } from './workflow-support.js'

const docsAgent = await createHarness({
  session: { id: process.env.DOCS_SESSION_ID },
  instructions:
    'Use the docs-writing and humanize skills for documentation work. ' +
    'Review code changes, or audit the implementation if no diff is supplied. ' +
    'Create missing docs and update stale ones. Run every runnable example ' +
    'in the docs and the project test suite. Fix documentation issues only. ' +
    'Report what passed, what failed, and anything you could not verify. ' +
    'Write that summary to run-output/agent-summary.md, then reply with it.',
})

const task = await getTask()
try {
  const result = await docsAgent.invoke(task, { limits: { turns: 30 } })
  if (result.stopReason !== 'endTurn') throw new Error(`Agent stopped: ${result.stopReason}`)
} finally {
  await docsAgent.memoryManager?.flush()
}
