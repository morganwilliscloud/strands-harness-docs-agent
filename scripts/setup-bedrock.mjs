// Connect the reader's repository to Bedrock using their own AWS and GitHub logins.
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

// Defaults in @strands-agents/harness 0.1.0. Update these when changing models.
export const modelIds = [
  'anthropic.claude-opus-5',
  'anthropic.claude-haiku-4-5-20251001-v1:0',
]

export function policies({ accountId, region, repository, ownerId, repositoryId }) {
  if (!/^\d{12}$/.test(accountId)) throw new Error('Expected an AWS account ID')
  if (!/^(us|eu|ap|sa|ca|me|af|il|mx)-[a-z]+-\d+$/.test(region)) throw new Error('Use a commercial AWS region')
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error('Use OWNER/REPO')
  if (![ownerId, repositoryId].every(id => /^\d+$/.test(String(id)))) throw new Error('Missing GitHub repository IDs')
  const [owner, name] = repository.split('/')
  const providerArn = `arn:aws:iam::${accountId}:oidc-provider/token.actions.githubusercontent.com`
  return {
    providerArn,
    trust: {
      Version: '2012-10-17',
      Statement: [{
        Effect: 'Allow',
        Principal: { Federated: providerArn },
        Action: 'sts:AssumeRoleWithWebIdentity',
        Condition: { StringEquals: {
          'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
          // Both exact repository formats; neither allows other repositories or branches.
          'token.actions.githubusercontent.com:sub': [
            `repo:${repository}:ref:refs/heads/main`,
            `repo:${owner}@${ownerId}/${name}@${repositoryId}:ref:refs/heads/main`,
          ],
        } },
      }],
    },
    modelPolicy: {
      Version: '2012-10-17',
      Statement: [{
        Effect: 'Allow',
        Action: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
        Resource: modelIds.flatMap(model => [
          `arn:aws:bedrock:*::foundation-model/${model}`,
          `arn:aws:bedrock:${region}:${accountId}:inference-profile/global.${model}`,
        ]),
      }],
    },
  }
}

function command(cmd, args, input) {
  return execFileSync(cmd, args, {
    encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
    ...(input === undefined ? {} : { input: JSON.stringify(input) }),
  }).trim()
}

function missingAwsResource(read) {
  try { return read() }
  catch (error) {
    // An authorization/network failure must not be mistaken for a missing resource.
    if (/\(NoSuchEntity\)/.test(String(error.stderr ?? error.message))) return null
    throw error
  }
}

export async function setupBedrock(
  { repository, region, directory = 'infra/generated' },
  run = command,
) {
  if (!repository || !region) throw new Error('Usage: npm run setup:bedrock -- OWNER/REPO AWS_REGION')
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error('Use OWNER/REPO')
  const parse = text => text ? JSON.parse(text) : null
  const aws = (...args) => parse(run('aws', [...args, '--output', 'json', '--no-cli-pager']))
  const gh = (route, body) => parse(run('gh',
    ['api', route, ...(body === undefined ? [] : ['--method', 'PUT', '--input', '-'])], body))
  const variable = (name, value) => run('gh', ['variable', 'set', name, '--repo', repository, '--body', value])

  const identity = aws('sts', 'get-caller-identity')
  const repo = gh(`repos/${repository}`)
  if (repo.default_branch !== 'main') throw new Error('This tutorial expects a main default branch')
  if (!repo.permissions?.admin) throw new Error('Sign in to gh with administrator access to this repository')
  const oidc = gh(`repos/${repository}/actions/oidc/customization/sub`)
  if (!oidc.use_default) throw new Error('Custom OIDC subjects need a matching trust policy. This setup supports the default repository subject.')
  const workflowPermissions = gh(`repos/${repository}/actions/permissions/workflow`)
  const result = policies({ accountId: identity.Account, region, repository: repo.full_name,
    ownerId: repo.owner.id, repositoryId: repo.id })
  const roleName = `DocsAgent-${repo.id}`
  const roleArn = `arn:aws:iam::${identity.Account}:role/${roleName}`
  const provider = missingAwsResource(() => aws('iam', 'get-open-id-connect-provider',
    '--open-id-connect-provider-arn', result.providerArn))
  if (provider && !provider.ClientIDList?.includes('sts.amazonaws.com')) {
    throw new Error('The existing GitHub OIDC provider lacks the sts.amazonaws.com audience. Ask its administrator to configure it.')
  }
  const existing = missingAwsResource(() => aws('iam', 'get-role', '--role-name', roleName))
  if (existing && !existing.Role.Tags?.some(tag =>
    tag.Key === 'DocsAgentRepositoryId' && tag.Value === String(repo.id))) {
    throw new Error(`Role ${roleName} already exists and is not owned by this setup. Refusing to overwrite it.`)
  }

  await mkdir(directory, { recursive: true })
  for (const [name, data] of [['github-trust.json', result.trust], ['bedrock-models.json', result.modelPolicy],
    ['setup.json', { repository: repo.full_name, region, roleName, roleArn }]]) {
    await writeFile(`${directory}/${name}`, JSON.stringify(data, null, 2) + '\n')
  }

  // Enable last. An interrupted setup leaves automatic model calls disabled.
  variable('DOCS_AGENT_ENABLED', 'false')
  if (!workflowPermissions.can_approve_pull_request_reviews) {
    gh(`repos/${repository}/actions/permissions/workflow`, {
      default_workflow_permissions: workflowPermissions.default_workflow_permissions,
      can_approve_pull_request_reviews: true,
    })
  }
  if (!provider) {
    try {
      aws('iam', 'create-open-id-connect-provider', '--url', 'https://token.actions.githubusercontent.com',
        '--client-id-list', 'sts.amazonaws.com')
    } catch (error) {
      if (!/\(EntityAlreadyExists\)/.test(String(error.stderr ?? error.message))) throw error
      const shared = aws('iam', 'get-open-id-connect-provider', '--open-id-connect-provider-arn', result.providerArn)
      if (!shared.ClientIDList?.includes('sts.amazonaws.com')) throw error
    }
  }
  if (existing) {
    aws('iam', 'update-assume-role-policy', '--role-name', roleName,
      '--policy-document', JSON.stringify(result.trust))
  } else {
    aws('iam', 'create-role', '--role-name', roleName,
      '--assume-role-policy-document', JSON.stringify(result.trust),
      '--tags', JSON.stringify([{ Key: 'DocsAgentRepositoryId', Value: String(repo.id) }]))
  }
  aws('iam', 'put-role-policy', '--role-name', roleName, '--policy-name', 'BedrockModels',
    '--policy-document', JSON.stringify(result.modelPolicy))
  variable('AWS_REGION', region)
  variable('AWS_ACCOUNT_ID', identity.Account)
  variable('AWS_ROLE_ARN', roleArn)
  variable('DOCS_AGENT_ENABLED', 'true')
  return { repository: repo.full_name, roleName }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [repository, region] = process.argv.slice(2)
    if (process.argv.length !== 4) throw new Error('Usage: npm run setup:bedrock -- OWNER/REPO AWS_REGION')
    const result = await setupBedrock({ repository, region })
    console.log(`Connected ${result.repository} to Bedrock. Merge the sample code change to start the agent.`)
    console.log('Generated settings are in infra/generated/ (gitignored). No model was invoked by setup.')
  } catch (error) {
    console.error(String(error.stderr ?? error.message).trim())
    console.error('Setup did not complete. Fix the reported issue and rerun the same command.')
    process.exitCode = 1
  }
}
