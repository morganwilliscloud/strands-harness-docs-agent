# Build a documentation agent with Strands harness

Merge an application change, get a documentation pull request, then leave feedback
and have the agent revise that same PR. In this tutorial, you'll build a
documentation agent with Strands harness and run it in GitHub Actions. You'll
give it writing skills, continue conversations when you leave feedback, and
preserve useful preferences across documentation jobs.

Request Report is the included sample app. It helps developers inspect web-server
traffic, spot failed requests, and check response times. You can run the tutorial
in your own copy, then move the documentation bot into an existing project.

This is an example application, not the official documentation bot for Strands harness.

## The agent

The agent lives in [`.github/agents/docs-agent.ts`](.github/agents/docs-agent.ts):

```ts
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
```

`createHarness()` provides the agent's tuned system prompt, built-in tools, context
management, sessions, and memory. Your `instructions` add the job. The `getTask()`
helper supplies the code change or review feedback for this run. `invoke()` starts
the work; the turn limit bounds one invocation, and `flush()` waits for pending
memory writes before the process exits.

The workflow around this file supplies GitHub events, restores state, independently
checks the proposed edits, and publishes the PR. The agent edits files and writes
a summary. It does not receive the publishing job's GitHub write token.

## 1. Create your own repository

You need Node.js 22 or newer, Git, and the [GitHub CLI](https://cli.github.com/).
Model-free checks work immediately; running the agent also needs model access.

Download this repository's source ZIP from **Code → Download ZIP**, extract it,
and open a terminal in the extracted folder. This copies the sample app and bot
without carrying the tutorial repository's Git history into your project.

```sh
gh auth login
git init -b main
git add .
git commit -m "Add Request Report and its documentation agent"
gh repo create my-docs-agent-demo --private --source=. --remote=origin --push
```

Choose your own repository name and visibility. The documentation workflow stays
disabled until you explicitly enable it in step 3. Ordinary CI checks need no
model credentials.

Already have a repository? Follow [Copy the bot into another project](tutorial/adapting.md).
Do not copy this repository's Git history or generated state into that project.

## 2. Run the app and checks

```sh
npm ci
npm run check
npm test
npm run docs:check
```

These commands do not call a model. Try the sample app:

```sh verify
node bin/request-report.mjs fixtures/requests.jsonl
```

It prints request counts, server errors, p95 latency, and traffic by route.
You can also generate an interactive HTML report:

```sh
node bin/request-report.mjs fixtures/requests.jsonl --format html > report.html
```

Open `report.html` in a browser. Application details live in the
[usage guide](docs/usage.md) and [log format guide](docs/log-format.md).

## 3. Connect the agent to your model account

Choose a setup path:

- **[Amazon Bedrock](tutorial/setup.md):** keep the agent as shown and use GitHub OIDC.
- **[OpenAI, Anthropic, or OpenRouter](tutorial/model-providers.md):** add the model
  configuration and replace the AWS credential step with your provider's API key.
  No AWS account is needed for these paths.

This tutorial uses Amazon Bedrock through short-lived GitHub OIDC credentials.
You create the role in **your own AWS account** and connect **your own GitHub
repository**. No account IDs, roles, or credentials from the original demo are
included.

Sign in to the AWS and GitHub CLIs, then run:

```sh
npm run setup:bedrock -- YOUR-OWNER/YOUR-REPO us-east-1
```

This creates the repository-specific role, configures GitHub, and enables the bot.
See [Bedrock setup](tutorial/setup.md) for prerequisites and troubleshooting.

The pinned published package is `@strands-agents/harness@0.1.0`. Its default main
model is Bedrock Claude Opus 5, with Haiku for background extraction/summarization.
Confirm model availability in your account.

Strands harness supports other model providers. Bedrock is the configuration
implemented by this workflow; changing providers also means changing credentials
and removing the Bedrock step. Follow the [provider setup instructions](tutorial/model-providers.md).
Bedrock invocations and GitHub runner usage can incur charges.

## 4. Merge a change and watch the bot work

Try adding a `--version` command to the sample app. Start a branch:

```sh
git switch -c feature/version-command
```

In `bin/request-report.mjs`, add this at the beginning of `main(args)`, before
the existing `--help` check:

```js
if (args.length === 1 && args[0] === '--version') {
  console.log('1.0.0')
  return
}
```

Leave the documentation unchanged so the bot has something to update. Verify the
new command prints `1.0.0`, run the tests, and open a PR:

```sh
node bin/request-report.mjs --version
npm test
git add bin/request-report.mjs
git commit -m "Add a version command"
git push -u origin feature/version-command
gh pr create --base main --title "Add a version command" \
  --body "Add --version to Request Report. Let the documentation agent update its usage guide after merge."
```

Merge that feature PR after its checks pass. Open **Actions → Update documentation**
and expand **Investigate and update documentation** to watch the agent's tools,
skill loading, and final response.

After the agent finishes, the workflow reruns tests and documentation checks,
rejects changes outside `README.md` and Markdown under `docs/`, and opens a PR
from a `docs/update-…` branch. Review the result before merging.

For later runs, make another application change. For a manual run, use
**Run workflow** and supply a full `base_sha` that
is an ancestor of `main`. Markdown-only merges do not trigger another docs run.

## 5. Give it feedback

On the **open documentation PR**, submit a new conversation comment:

```text
@docs-bot revise Add a troubleshooting example for passing an input file together with --version. Run it and verify stderr and the exit status.
```

`@docs-bot` is a command prefix, not a GitHub user; no mention dropdown is expected.
Only repository writers can trigger a revision. Editing an old comment does not
trigger it. The workflow restores this PR's conversation and passes the same
session ID to Strands harness. Your comment becomes the next request.

After validation, the publishing job updates the **same PR** and posts the summary.
In the logs, look for `Resuming PR #…` and the count of prior messages.
Keep this PR open until you finish the feedback exercise.

## What Strands harness handles

The factory gives this agent capabilities that would otherwise need wiring:

- **A tuned system prompt.** `instructions` extends it with documentation-specific work.
- **File and shell tools.** The agent can inspect code, update Markdown, and run examples.
  Web fetching is also built in; native web search depends on provider support.
- **Context management.** Large tool results can be offloaded and older conversation
  turns summarized, with tools to retrieve offloaded content.
- **Prompt caching where supported.** Reused input can be cached through the provider.
  This example does not promise a specific cache hit rate or cost reduction.
- **Skills.** Guidance in [`.agent/skills`](.agent/skills) is discovered automatically.
  The maintainer skill defines the job; writing and humanize skills guide the prose.
- **Task tracking, delegation, and programmatic tool calling.** These are available
  defaults; the model chooses whether to use them for a given task.
- **Sessions and long-term memory.** Strands harness manages conversation state and
  extracts useful facts for later tasks. GitHub Actions preserves the files.

You can override defaults and add tools or MCP integrations without replacing the agent.

### Sessions are conversations; memory is shared knowledge

Each new code-change job starts a session. A revision restores only that job's
saved session. A separate artifact contains shared repository memory, so a new
session can still retrieve useful preferences learned from earlier PRs.

For example, tell the bot: “For future docs, put runnable examples before option
tables.” Memory extraction is model-driven; not every comment becomes a memory.
The workflow also collects new authorized review feedback from earlier docs PRs.
Ordinary comments and inline reviews are collected on the next run, but only the
explicit command above triggers an immediate revision.

The model extracts memory into Markdown files. The pinned version's default
retrieval uses keyword matching, not a vector database. The final `flush()` waits
for extraction before saving. Use separate memory stores for unrelated projects
or customers; changing a session ID alone does not isolate long-term memory.

Artifacts are retained for 90 days. The scripts select the relevant session and
latest successful memory snapshot; they do not download every previous session.
If a PR session expires, revision fails explicitly. Missing shared memory means
a fresh memory store. See [State and workflow details](.github/workflow-state.md).

## Use the bot in your application

Start with the sample to learn the full loop, then follow
[Copy the bot into another project](tutorial/adapting.md). You will keep the agent,
workflow, state scripts, and skills, and customize the task, watched paths,
validation commands, and allowed documentation paths for your app.

The agent runs inside the GitHub runner and can execute commands. The Markdown
allowlist validates its output; it is not an execution sandbox. Use this sample
with code and maintainers you trust. The agent has read-only GitHub permissions
and model-invocation access; a separate job gets permission to publish.

Repository layout:

```text
.github/agents/docs-agent.ts       # the one agent entry point
.github/agents/workflow-support.ts # task text, including review feedback
.github/workflows/docs.yml         # trigger, restore, run, validate, publish
.agent/skills/                    # documentation and writing guidance
scripts/docs-session.mjs           # restore/save one documentation job
scripts/docs-memory.mjs            # shared memory and reviewer feedback
scripts/prepare-docs-patch.mjs      # independent checks and Markdown patch
scripts/publish-docs-pr.mjs         # create or revise the PR
bin/                              # Request Report sample application
docs/                             # Request Report application documentation
tutorial/                         # setup, providers, and adaptation guides
```

To stop automatic runs, set `DOCS_AGENT_ENABLED` to `false`. Cleanup steps and
troubleshooting are in the [setup guide](tutorial/setup.md#cleanup).

Build an agent for a task you want automated, and share what you make.

## Resources

- [Strands harness documentation](https://strandsagents.com/docs/user-guide/harness/)
- [Configuration and SDK composition](https://strandsagents.com/docs/user-guide/harness/composing-with-sdk/)
- [CLI quickstart and code export](https://strandsagents.com/docs/user-guide/harness/quickstart/#build-an-agent-with-the-cli)

Licensed under [Apache 2.0](LICENSE).
