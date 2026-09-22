import test from 'node:test'
import assert from 'node:assert/strict'
import { policies, modelIds } from '../scripts/prepare-bedrock.mjs'

test('generated policies use only the reader account and exact repository subjects', () => {
  const accountId = '1'.repeat(12)
  const result = policies({ accountId, region: 'us-east-1', repository: 'reader/project',
    ownerId: 7, repositoryId: 9 })
  const trust = result.trust.Statement[0]
  assert.equal(trust.Principal.Federated, result.providerArn)
  assert.deepEqual(trust.Condition.StringEquals['token.actions.githubusercontent.com:sub'], [
    'repo:reader/project:ref:refs/heads/main',
    'repo:reader@7/project@9:ref:refs/heads/main',
  ])
  const statement = result.modelPolicy.Statement[0]
  assert.deepEqual(statement.Action, ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'])
  assert.equal(statement.Resource.length, modelIds.length * 2)
  for (const resource of statement.Resource) {
    assert.ok(resource.includes('::foundation-model/') || resource.includes(`:${accountId}:inference-profile/`))
    assert.ok(modelIds.some(id => resource.endsWith(id)))
  }
})

test('policy generation rejects invalid account, region, and repository input', () => {
  const input = { accountId: '1'.repeat(12), region: 'us-east-1', repository: 'reader/project',
    ownerId: 7, repositoryId: 9 }
  for (const change of [{ accountId: '*' }, { region: '*' }, { repository: 'reader/*' },
    { ownerId: 'not-an-id' }]) {
    assert.throws(() => policies({ ...input, ...change }))
  }
})
