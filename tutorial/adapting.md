# Copy the bot into another project

First run the sample once so you have seen a documentation PR and a revision.
Then copy the integration into a repository whose code and docs you control.
The sample app does not need to come with it.

## Files to copy

Preserve the relative paths:

```text
.github/agents/docs-agent.ts
.github/agents/workflow-support.ts
.github/workflows/docs.yml
.agent/skills/
scripts/docs-session.mjs
scripts/docs-memory.mjs
scripts/prepare-docs-patch.mjs
scripts/publish-docs-pr.mjs
scripts/setup-bedrock.mjs
```

Copy `scripts/check-docs.mjs` only if you intend to adapt the sample's documentation
checker. It currently runs `node bin/request-report.mjs` examples; it is not a
general-purpose checker for every application's documentation.

Do not copy `.git`, `node_modules`, runtime sessions/memory, generated AWS
policies, or another repository's Actions artifacts.

## Merge dependencies and scripts

In an existing Node project, merge into its package files instead of replacing them:

```sh
npm install --save-exact @strands-agents/harness@0.1.0 @strands-agents/sdk@1.17.0 tsx@4.23.13
```

Add scripts for the agent and patch preparation:

```json
{
  "agent:docs": "tsx .github/agents/docs-agent.ts",
  "docs:patch": "node scripts/prepare-docs-patch.mjs",
  "setup:bedrock": "node scripts/setup-bedrock.mjs"
}
```

Define `docs:check` to verify your application's documentation examples and links.
The patch preparer runs it before publication. Merge the TypeScript configuration
if you want the agent included in type checks. Commit the updated lockfile.

For a Python, Go, or other application, the bot can still run in TypeScript.
Install that language's runtime in the workflow and make the documentation
checks run the appropriate commands. Node is needed for the bot and its helper
scripts, not for your application.

Add the following to your `.gitignore`:

```text
node_modules/
.env
.env.*
.agent/sessions/
.agent/memory/
run-output/
infra/generated/
```

## Customize the application-specific pieces

| Location | What to change |
| --- | --- |
| `.agent/skills/docs-maintainer/SKILL.md` | Replace Request Report instructions, example commands, and documentation conventions with your project's. Keep instructions to verify work and avoid publishing from the agent. |
| `.github/agents/docs-agent.ts` | Adjust the documentation job. Keep the session ID and flush if you want the demonstrated continuity. |
| `.github/workflows/docs.yml` | Change `on.push.paths` to your application paths and install required runtimes. Keep Markdown-only updates from triggering an endless docs loop. |
| `scripts/prepare-docs-patch.mjs` | Set allowed output paths and the checks to run. |
| `scripts/docs-session.mjs` | Keep `docPath()` aligned with those allowed paths. |
| `scripts/publish-docs-pr.mjs` | Keep the publisher's allowlist aligned with the same paths. |
| `.github/agents/workflow-support.ts` | Update allowed-path wording and any project-specific task context. |

The copied scripts assume a `main` default branch, `README.md` plus Markdown under
`docs/`, and this workflow's artifact naming. If you change those conventions,
update all matching checks and the OIDC trust policy together.

For Bedrock, set up a **new repository-specific IAM trust policy** and variables
using the [setup guide](setup.md). For direct API providers, follow the
[OpenAI, Anthropic, or OpenRouter guide](model-providers.md).
Copying files does not copy GitHub settings, secrets, permissions, roles, or artifacts.

Start with a small source change, inspect the docs PR, and request a revision.
Run your documentation checks and inspect state restoration before depending on the integration.

## Change the model provider

The default agent leaves `model` unset for Bedrock. The
[provider guide](model-providers.md) contains the exact agent edits, GitHub secret
commands, and replacement workflow steps for OpenAI, Anthropic, and OpenRouter.
It also explains which model handles background memory extraction.

For a different Bedrock model, update the generated model policy as well.

## What to keep from the workflow

The separate publisher, authorization checks on feedback, independent documentation checks,
and stale-PR-head checks are part of the demonstrated implementation. They ensure
the workflow only publishes a validated documentation patch and does not overwrite
someone else's newer PR edits. Do not replace them with an unconditional push.

The output checks do not sandbox the agent's shell. If you need to process
untrusted source or execute third-party code, choose an appropriate isolated
execution environment and permissions for that application.
