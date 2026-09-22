# Set up Bedrock access for your repository

This setup uses your AWS account and your GitHub repository. It does not require
an AWS access key stored in GitHub. GitHub obtains a short-lived OIDC token,
and AWS exchanges it for permission to invoke the selected Bedrock models.

Prerequisites: an AWS account with access to the models, permission to manage
IAM roles/providers, the AWS CLI, GitHub CLI, and repository administrator access.
The example targets commercial AWS regions and a `main` default branch.

## Generate your policies

Authenticate the AWS CLI using your normal login or SSO profile, and authenticate
`gh` to GitHub. Set `AWS_PROFILE` first if you use a named profile.

Run from your new repository. Replace `YOUR-OWNER/YOUR-REPO` with its full name:

```sh
export DOCS_REPO="YOUR-OWNER/YOUR-REPO"
export AWS_REGION="us-east-1"
export DOCS_ROLE_NAME="DocsAgent-$(gh api "repos/$DOCS_REPO" --jq .id)"
export AWS_ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
export DOCS_OIDC_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"

node scripts/prepare-bedrock.mjs "$DOCS_REPO" "$AWS_REGION"
```

The helper reads your AWS identity and GitHub repository metadata. It writes:

- `infra/generated/github-trust.json`: trust restricted to this repository's `main`
  branch. It includes exact name-based and immutable-ID subject formats.
- `infra/generated/bedrock-models.json`: model invocation permission for the main
  and background models used by the pinned Strands harness package.

Review these files before continuing. They are gitignored because they contain
your account and repository identifiers. The helper does not create cloud
resources, change GitHub settings, or invoke a model.

Repositories using a custom OIDC subject must adapt the trust policy to their
configured claims; the helper stops instead of guessing. A GitHub Actions
environment also changes the OIDC subject, so this workflow intentionally does
not set `environment:`.

## Create the provider and role

Check whether your AWS account already has GitHub's OIDC provider:

```sh
aws iam get-open-id-connect-provider --open-id-connect-provider-arn "$DOCS_OIDC_ARN"
```

If it exists, reuse it and confirm its client ID list includes `sts.amazonaws.com`.
If the command reports `NoSuchEntity`, create it:

```sh
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com
```

If you get `AccessDenied`, ask an administrator to perform setup; it does not
mean the provider is missing.

Create a role for this repository and attach the generated model policy:

```sh
aws iam create-role \
  --role-name "$DOCS_ROLE_NAME" \
  --assume-role-policy-document file://infra/generated/github-trust.json

aws iam put-role-policy \
  --role-name "$DOCS_ROLE_NAME" \
  --policy-name BedrockModels \
  --policy-document file://infra/generated/bedrock-models.json
```

For an existing role created by this tutorial, use `aws iam update-assume-role-policy`
with the same trust document instead of creating the role again.

The policy grants only Bedrock model invocation, not access to your other AWS
resources. It covers Opus 5 and Haiku for `@strands-agents/harness@0.1.0`.
Cross-region inference also requires access to the underlying foundation models,
so those two model ARNs allow destination regions. Organization policies and
model access requirements still apply.

## Configure GitHub Actions

Allow GitHub Actions to create pull requests:

**Settings → Actions → General → Workflow permissions → Allow GitHub Actions
to create and approve pull requests.**

The workflow declares permissions separately for its two jobs; you can keep the
repository's default token permissions read-only. If an organization disables PR
creation, an organization administrator must change that policy.

Set repository variables:

```sh
gh variable set AWS_REGION --repo "$DOCS_REPO" --body "$AWS_REGION"
gh variable set AWS_ACCOUNT_ID --repo "$DOCS_REPO" --body "$AWS_ACCOUNT_ID"
gh variable set AWS_ROLE_ARN --repo "$DOCS_REPO" \
  --body "arn:aws:iam::${AWS_ACCOUNT_ID}:role/${DOCS_ROLE_NAME}"
gh variable set DOCS_AGENT_ENABLED --repo "$DOCS_REPO" --body "true"
```

These are configuration values, not long-lived credentials. Do not add your
laptop's AWS access keys as GitHub secrets. All future model calls are billed
to the account you configured.

Now return to [Merge a change and watch the bot work](../README.md#4-merge-a-change-and-watch-the-bot-work).

## Local agent run (optional)

With your AWS credentials available locally:

```sh
npm ci
npm run agent:docs
```

This invokes the same agent to audit the checked-out repository. It can edit
documentation and run commands locally. Inspect its diff afterward. It does not
open a PR; publication is part of the GitHub workflow.

For a particular change, set `BASE_SHA` and `HEAD_SHA` to full commit hashes,
with `HEAD_SHA` matching your checkout. Runtime output lives in gitignored
`run-output/`, `.agent/sessions/`, and `.agent/memory/`.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Documentation job skipped | Set `DOCS_AGENT_ENABLED=true`; merge a change in `bin/`, `test/`, `fixtures/`, or package files. Initial repository creation and Markdown-only changes are skipped. |
| OIDC role assumption fails | Check the account, repository, `main` branch, subject format, audience, and any organization-specific subject customization. |
| Bedrock invocation denied | Check model availability, the region, organizational policies, and both main/background model permissions. |
| PR creation denied | Enable Actions PR creation in repository/organization settings. |
| Comment does nothing | Submit a **new conversation comment** beginning exactly `@docs-bot revise`; it must target an open bot-created docs PR and come from a repository writer. |
| Saved session unavailable | Artifacts expired or were deleted. The revision fails rather than silently losing history. Start a new documentation job instead. |
| Native web search warning | This docs bot investigates local source. The default Bedrock model may not provide native web search; that warning does not prevent file/shell tools from working. |
| No docs PR appears | Inspect the agent summary. There may be no docs change needed, or a validation failure. |
| PR shows no additional check run | GitHub can suppress events created with `GITHUB_TOKEN`. The docs workflow checks the patch before publishing; inspect that run's validation steps. |

## Cleanup

Disable the bot first:

```sh
gh variable set DOCS_AGENT_ENABLED --repo "$DOCS_REPO" --body "false"
```

If you no longer need the role created for this repository:

```sh
aws iam delete-role-policy --role-name "$DOCS_ROLE_NAME" --policy-name BedrockModels
aws iam delete-role --role-name "$DOCS_ROLE_NAME"
```

Keep a shared GitHub OIDC provider if other roles use it. Delete retained Actions
artifacts if you want to remove the saved conversations and memory. Locally,
remove the generated policies and runtime directories when you no longer need them.

## Reference

- [GitHub OIDC with AWS](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws)
- [AWS credential action](https://github.com/aws-actions/configure-aws-credentials)
- [Bedrock cross-region inference](https://docs.aws.amazon.com/bedrock/latest/userguide/cross-region-inference.html)
