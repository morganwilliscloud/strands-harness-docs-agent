# Connect GitHub Actions to Bedrock

Using OpenAI, Anthropic, or OpenRouter? Follow the
[provider guide](model-providers.md) instead. No AWS setup is needed for those paths.

## Sign in

You need the AWS CLI, GitHub CLI, a repository with `main` as its default branch,
and access to the Bedrock models in your chosen region. Your AWS identity must
be allowed to manage IAM roles and OIDC providers; your GitHub login must have
administrator access to your repository.

Sign in to the AWS CLI using your normal login or SSO profile, then run:

```sh
gh auth login
```

If you use a named AWS profile, set `AWS_PROFILE` before continuing.

## Run setup

From your repository directory, replace `YOUR-OWNER/YOUR-REPO` with its full name:

```sh
npm run setup:bedrock -- YOUR-OWNER/YOUR-REPO us-east-1
```

Use a commercial AWS region where your account can invoke the models.
The command uses **your signed-in AWS account** and the repository you specify.
It configures actual resources and settings:

- Reuses the account's GitHub OIDC provider, or creates one if needed.
- Creates a role restricted to your repository's `main` branch and the models
  used by the pinned Strands harness package.
- Enables GitHub Actions PR creation while preserving the default token permissions.
- Sets the AWS repository variables, then enables the documentation bot.

GitHub will use temporary credentials to assume that role. You do not need to
copy AWS access keys into GitHub secrets.

When the command completes, follow
[Merge a change and watch the bot work](../README.md#4-merge-a-change-and-watch-the-bot-work).
Setup does not invoke a model; subsequent agent runs incur model and runner usage.

You can rerun the command. It updates the role it created for that repository
and refuses to overwrite an unrelated role. Generated policies and settings
are saved under gitignored `infra/generated/`, so your account identifiers
do not become part of the tutorial's source.

## What Strands harness needs access to

The pinned package uses Bedrock Claude Opus 5 for the main agent and Haiku for
background memory extraction and web summarization. The role grants only
`bedrock:InvokeModel` and `bedrock:InvokeModelWithResponseStream` for those models.
Global inference also requires access to those foundation models in destination
regions. Account-level model access requirements and organization policies still apply.

If you change models, update `modelIds` in `scripts/setup-bedrock.mjs` and rerun
setup to update the role. GitHub credentials and AWS credentials are separate:
the agent job can read GitHub data, while a separate publishing job can write PRs.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Setup reports `AccessDenied` | Ask an administrator to run setup or grant the required IAM permissions. The script does not treat authorization errors as missing resources. |
| GitHub rejects PR creation settings | Your organization may restrict the setting. Ask its administrator to allow Actions PR creation, then rerun setup. |
| Existing role is not owned by setup | The command will not overwrite it. Inspect that role before choosing to rename/remove it or configure the integration manually. |
| Custom OIDC subject | This helper supports GitHub's default repository subject. A custom subject or Actions environment needs a matching custom trust policy. |
| Setup stopped partway through | Fix the reported issue and rerun. Once configuration begins, the bot remains disabled until setup finishes. |
| Documentation job skipped | Confirm `DOCS_AGENT_ENABLED=true` and merge a change in `bin/`, `fixtures/`, or package files. Markdown-only changes and initial repo creation are skipped. |
| Bedrock invocation denied | Check model availability, region, organization policies, and permissions for both the main and background models. |
| Comment does nothing | Submit a new conversation comment beginning `@docs-bot revise` on an open bot-created docs PR, as a repository writer. |
| Saved session unavailable | Its artifact expired or was deleted. Start a new documentation job. |
| Native web search warning | This bot reads local source; the warning does not prevent file and shell tools from working. |
| PR has no extra check run | Inspect the originating docs workflow. It validates the patch before publishing; GitHub may suppress follow-on events created with its token. |

## Local run (optional)

With your AWS credentials available locally:

```sh
npm ci
npm run agent:docs
```

This runs the same agent against your local checkout. It can edit documentation
and execute commands. Review the diff afterward. PR creation belongs to the
GitHub workflow and does not happen during this local command.

## Cleanup

Disable automatic agent runs:

```sh
export DOCS_REPO="YOUR-OWNER/YOUR-REPO"
gh variable set DOCS_AGENT_ENABLED --repo "$DOCS_REPO" --body "false"
```

To remove the role this setup created:

```sh
export DOCS_ROLE_NAME="DocsAgent-$(gh api "repos/$DOCS_REPO" --jq .id)"
aws iam delete-role-policy --role-name "$DOCS_ROLE_NAME" --policy-name BedrockModels
aws iam delete-role --role-name "$DOCS_ROLE_NAME"
```

Keep a shared OIDC provider if other roles use it. Delete retained Actions
artifacts to remove saved sessions and memory. Remove local generated settings
and runtime files when you no longer need them.

## Reference

- [GitHub OIDC with AWS](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws)
- [AWS credential action](https://github.com/aws-actions/configure-aws-credentials)
