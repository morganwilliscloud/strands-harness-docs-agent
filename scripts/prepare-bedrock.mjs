// Generate reader-owned policies locally. This does not create AWS resources.
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

async function main() {
  const [repository, region] = process.argv.slice(2)
  if (!repository || !region) throw new Error('Usage: node scripts/prepare-bedrock.mjs OWNER/REPO AWS_REGION')
  const json = (cmd, args) => JSON.parse(execFileSync(cmd, args, { encoding: 'utf8' }))
  const identity = json('aws', ['sts', 'get-caller-identity', '--output', 'json'])
  const repo = json('gh', ['api', `repos/${repository}`])
  if (repo.default_branch !== 'main') throw new Error('This tutorial expects a main default branch')
  const oidc = json('gh', ['api', `repos/${repository}/actions/oidc/customization/sub`])
  if (!oidc.use_default) throw new Error('This repository uses a custom OIDC subject. Adapt the trust policy to its configured claims first.')
  const result = policies({ accountId: identity.Account, region, repository: repo.full_name,
    ownerId: repo.owner.id, repositoryId: repo.id })
  await mkdir('infra/generated', { recursive: true })
  for (const [name, data] of [['github-trust.json', result.trust], ['bedrock-models.json', result.modelPolicy]]) {
    await writeFile(`infra/generated/${name}`, JSON.stringify(data, null, 2) + '\n')
  }
  console.log('Wrote reader-specific policies to infra/generated/ (gitignored). Review them before creating the IAM role.')
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main()
}
