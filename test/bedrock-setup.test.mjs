import test from 'node:test'
import assert from 'node:assert/strict'
import { policies, modelIds, setupBedrock } from '../scripts/setup-bedrock.mjs'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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

function fixture(options = {}) {
  const calls = []
  const absent = () => { throw Object.assign(new Error('missing'), { stderr: '(NoSuchEntity)' }) }
  const run = (cmd, args, input) => {
    calls.push({ cmd, args, input })
    const operation = args.slice(0, 2).join(' ')
    if (operation === options.failAt) throw Object.assign(new Error('denied'), { stderr: '(AccessDenied)' })
    if (cmd === 'aws') {
      if (operation === 'sts get-caller-identity') return JSON.stringify({ Account: '1'.repeat(12) })
      if (operation === 'iam get-open-id-connect-provider') {
        return options.existing ? JSON.stringify({ ClientIDList: ['sts.amazonaws.com'] }) : absent()
      }
      if (operation === 'iam get-role') {
        return options.existing ? JSON.stringify({ Role: { Tags: [
          { Key: 'DocsAgentRepositoryId', Value: options.foreignRole ? 'other' : '9' },
        ] } }) : absent()
      }
      return '{}'
    }
    if (args[0] === 'variable') return ''
    if (args[1] === 'repos/reader/project') {
      return JSON.stringify({ full_name: 'reader/project', id: 9, owner: { id: 7 },
        default_branch: 'main', permissions: { admin: true } })
    }
    if (args[1].endsWith('customization/sub')) return JSON.stringify({ use_default: !options.customSubject })
    if (args[1].endsWith('permissions/workflow')) {
      return input ? '' : JSON.stringify({
        default_workflow_permissions: 'read', can_approve_pull_request_reviews: false,
      })
    }
    throw new Error(`Unexpected fixture command: ${cmd} ${args.join(' ')}`)
  }
  return { calls, run }
}

async function setupFixture(t, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'docs-setup-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const fake = fixture(options)
  return { ...fake, directory, setup: () => setupBedrock({
    repository: 'reader/project', region: 'us-east-1', directory,
  }, fake.run) }
}

test('one-command setup creates scoped resources and enables the bot only after configuration', async t => {
  const f = await setupFixture(t)
  await f.setup()
  const operations = f.calls.filter(c => c.cmd === 'aws').map(c => c.args[1])
  assert.ok(operations.includes('create-open-id-connect-provider'))
  assert.ok(operations.includes('create-role'))
  assert.ok(operations.includes('put-role-policy'))
  const settings = f.calls.filter(c => c.args[0] === 'variable')
  assert.deepEqual(settings.map(c => [c.args[2], c.args.at(-1)]), [
    ['DOCS_AGENT_ENABLED', 'false'], ['AWS_REGION', 'us-east-1'],
    ['AWS_ACCOUNT_ID', '1'.repeat(12)],
    ['AWS_ROLE_ARN', `arn:aws:iam::${'1'.repeat(12)}:role/DocsAgent-9`],
    ['DOCS_AGENT_ENABLED', 'true'],
  ])
  const githubSettings = f.calls.find(c => c.input)
  assert.deepEqual(githubSettings.input, {
    default_workflow_permissions: 'read', can_approve_pull_request_reviews: true,
  })
  const trust = JSON.parse(await readFile(join(f.directory, 'github-trust.json'), 'utf8'))
  assert.match(JSON.stringify(trust), /repo:reader\/project:ref:refs\/heads\/main/)
})

test('rerunning setup reuses the shared provider and updates only its owned role', async t => {
  const f = await setupFixture(t, { existing: true })
  await f.setup()
  const operations = f.calls.filter(c => c.cmd === 'aws').map(c => c.args[1])
  assert.ok(!operations.includes('create-open-id-connect-provider'))
  assert.ok(!operations.includes('create-role'))
  assert.ok(operations.includes('update-assume-role-policy'))
})

test('an existing foreign role or custom subject is rejected before mutations', async t => {
  for (const options of [{ existing: true, foreignRole: true }, { customSubject: true }]) {
    const f = await setupFixture(t, options)
    await assert.rejects(f.setup())
    assert.equal(f.calls.filter(c => c.args[0] === 'variable' || c.input).length, 0)
    assert.equal(f.calls.some(c => c.args[1]?.startsWith('create-')), false)
  }
})

test('access denial is not treated as missing and partial setup never enables the bot', async t => {
  for (const failAt of ['iam get-open-id-connect-provider', 'iam put-role-policy']) {
    const f = await setupFixture(t, { failAt })
    await assert.rejects(f.setup())
    assert.equal(f.calls.some(c => c.args[2] === 'DOCS_AGENT_ENABLED' && c.args.at(-1) === 'true'), false)
    if (failAt.includes('get-open-id')) {
      assert.equal(f.calls.some(c => c.args[1] === 'create-open-id-connect-provider'), false)
    }
  }
})
