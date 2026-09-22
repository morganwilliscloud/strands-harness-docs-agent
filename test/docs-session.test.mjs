import test from 'node:test'
import assert from 'node:assert/strict'
import { parseRevision, validatePr, docPath } from '../scripts/docs-session.mjs'

test('revision command includes feedback and targets a PR', () => {
  assert.deepEqual(parseRevision({issue:{number:4,pull_request:{}},comment:{body:'@docs-bot revise Lead with an example.'}},'issue_comment'),{number:4,feedback:'Lead with an example.'})
  assert.throws(()=>parseRevision({issue:{number:4},comment:{body:'@docs-bot revise hi'}},'issue_comment'))
  assert.throws(()=>parseRevision({issue:{number:4,pull_request:{}},comment:{body:'thanks'}},'issue_comment'))
})
test('manual revision accepts the same PR and feedback payload', () => {
  assert.deepEqual(parseRevision({inputs:{pr_number:'4',feedback:'  Fix examples. '}},'workflow_dispatch'),{number:4,feedback:'Fix examples.'})
})
test('revision rejects forks, closed PRs, non-bot authors and arbitrary branches', () => {
  const pr={state:'open',head:{repo:{full_name:'owner/repo'},ref:'docs/update-012345abcdef'},base:{ref:'main'},user:{login:'github-actions[bot]'}}
  validatePr(pr,'owner/repo')
  for(const changed of [{...pr,state:'closed'},{...pr,user:{login:'someone'}},{...pr,head:{...pr.head,ref:'main'}},{...pr,head:{...pr.head,repo:{full_name:'fork/repo'}}}]) assert.throws(()=>validatePr(changed,'owner/repo'))
  assert.equal(docPath('README.md'),true);assert.equal(docPath('docs/usage.md'),true)
  assert.equal(docPath('agent.ts'),false);assert.equal(docPath('.github/workflows/docs.yml'),false)
})
