# Build a documentation agent with Strands

This repository is a small, runnable example of an application agent: a documentation maintainer that can inspect a project, update Markdown, run only the checks you explicitly allow, and retain the conversation for a later feedback pass.

It is designed to answer a practical question:

> How do I move from “an agent can do this on my laptop” to “my application can run this job repeatedly and safely”?

The answer is an agent harness. Here, the **Strands Agents SDK is the harness**: it supplies the model-driven agent loop, tool calling, session persistence, context management, model-provider integrations, tracing hooks, and extension points. Your application supplies the job, boundaries, and controls.

## What you will build

The agent in `src/docs_agent/` is given one narrowly defined job:

1. Read the implementation and existing documentation.
2. Update documentation that is affected by a requested change.
3. Run the repository’s approved checks.
4. Write a concise record of what it changed and verified.

It cannot run arbitrary shell commands. It has custom tools that restrict reads and writes to this repository and a check runner with an explicit allowlist. That is intentional: useful application agents need capabilities, but they also need boundaries.

```text
request or event
       |
       v
your application ---> Strands Agent ---> scoped project tools
       |                    |                 |
       |                    |                 +--> read source and docs
       |                    |                 +--> write Markdown
       |                    |                 +--> run approved checks
       |                    |
       |                    +--> local session snapshot
       |
       +--> artifact: summary for a reviewer or workflow
```

## Why use a harness?

Interactive coding agents are excellent collaborators while you build software. An application agent has a different operating model: it needs the same instructions, tools, controls, and observability every time it runs—whether the trigger is a command, a CI workflow, an event, or a background job.

Strands gives you a library you run in your own process. That means the agent you prototype is the same agent your product invokes. You keep ownership of:

- The instructions that define success.
- The connected systems and the permissions they receive.
- The model provider and deployment environment.
- The checks required before a result is accepted.
- The human review point for consequential changes.

## Prerequisites

- Python 3.10 or newer.
- A model provider supported by Strands.
- Credentials configured for that provider.

The sample defaults to the SDK’s Amazon Bedrock configuration. To use OpenAI instead, set `DOCS_AGENT_PROVIDER=openai`, `OPENAI_API_KEY`, and optionally `DOCS_AGENT_MODEL_ID`.

> Never put credentials in a prompt, source file, generated report, or session directory. Use environment variables or your deployment platform’s secret store.

## Step 1: install the example

```bash
git clone <your-fork-url>
cd strands-harness-docs-agent

python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

On Windows PowerShell, activate the environment with:

```powershell
.venv\Scripts\Activate.ps1
```

## Step 2: configure a model

### Default: Amazon Bedrock

The SDK uses its Bedrock provider when `DOCS_AGENT_PROVIDER` is not set. Configure AWS credentials with your normal local or deployment workflow and make sure the model you select is available in the region you use.

To select a model explicitly:

```bash
export DOCS_AGENT_MODEL_ID="your-bedrock-model-id"
```

### OpenAI

```bash
export DOCS_AGENT_PROVIDER=openai
export OPENAI_API_KEY="..."
export DOCS_AGENT_MODEL_ID="gpt-4.1-mini"
```

This provider choice belongs in application configuration, not agent instructions. The job and the tools stay the same.

## Step 3: run a focused task locally

Start with a request that has a clear result and a bounded scope:

```bash
python -m docs_agent.run \
  --session-id quickstart \
  --task "Read the source and docs. Improve the quickstart so it accurately explains how to run the documentation check. Run the docs check before you finish."
```

The command creates:

- `.agent-sessions/` — Strands snapshots of the conversation and state.
- `artifacts/last-run.md` — a local handoff record containing the request and agent response.

The first run is a prototype. Inspect the changed Markdown and the artifact before treating it as part of a workflow.

## Step 4: give the same agent feedback

Use the same session ID to continue the conversation on a later run:

```bash
python -m docs_agent.run \
  --session-id quickstart \
  --task "Revise the quickstart to add one short troubleshooting note for a missing virtual environment. Run the docs check and summarize the result."
```

`SnapshotSessionManager` restores the latest snapshot for that session. This is useful for a review loop: a person can request a correction without repeating the original task, and the agent can retain relevant context from its earlier work.

For a CI environment, persist `.agent-sessions/` only when that continuity is intentional. Session data may contain tool results and conversation content, so treat it as application data and secure it accordingly.

## Step 5: understand the harness

The key construction lives in `src/docs_agent/agent.py`:

```python
agent = Agent(
    model=build_model(),
    system_prompt=SYSTEM_PROMPT,
    tools=[
        list_project_files,
        read_project_file,
        write_project_file,
        run_project_check,
    ],
    context_manager="auto",
    session_manager=session_manager,
)
```

Each field has a distinct job:

| Piece | Why it is here |
| --- | --- |
| `model` | Keeps the provider choice in configuration. |
| `system_prompt` | Defines the job, quality bar, and limits. |
| `tools` | Gives the model carefully scoped ways to affect the project. |
| `context_manager="auto"` | Lets the SDK manage long-running context rather than leaving every tool result in the active conversation. |
| `session_manager` | Persists the conversation and state so a later run can continue it. |

The point is not to give an agent every possible tool. Start with the smallest tool set that can complete the job. Add a capability only when you can explain the permission, the failure mode, and how you will evaluate it.

## Step 6: make the agent useful for your application

The sample agent is intentionally generic. Its real value comes from the application-specific seams.

### Give it instructions it can follow

The system prompt tells the agent to prefer small, accurate edits; cite the source it used in its summary; and avoid changing application code. In your project, replace that with the policies that matter:

- Which directories it may modify.
- What “done” means for a task.
- Which verification steps are mandatory.
- When it should stop and ask a person for help.

### Add domain skills without repeating yourself

`skills/documentation/SKILL.md` is a small local writing guide. The agent is told to read it before editing documentation. This lets you store durable guidance—voice, structure, release-note conventions, security language—alongside the project rather than pasting it into every request.

### Connect the systems that matter

The custom project tools are a safe starting point, not a complete integration layer. Common next steps include:

- A read-only issue tracker or support-search tool.
- A tool that fetches a specific CI log or test report.
- An MCP server for an approved internal system.
- A structured API client that creates a draft for human review.

Make the narrow operation a tool. Avoid giving a broad network, database, or shell capability when a focused tool can solve the job.

### Keep the reviewable output outside the conversation

The agent returns prose, but the application also writes `artifacts/last-run.md`. In a production service, this record could become a pull-request comment, a job log, a review UI, or an event payload. A reviewer should be able to see:

1. What request triggered the work.
2. Which files changed.
3. What was verified.
4. What remains uncertain.

## GitHub Actions starter

The workflow at `.github/workflows/documentation-agent.yml` is deliberately manual (`workflow_dispatch`). It is a safe way to prove the setup in your own repository before connecting it to pull-request comments, merges, schedules, or external events.

Add provider credentials as repository or environment secrets. Then trigger it from the Actions tab and supply a narrow task.

Before enabling event-driven writes, decide:

- Which events are trusted enough to invoke the agent.
- Whether external contributors can influence the prompt.
- Which branch and files the agent can modify.
- Whether the workflow opens a draft or changes files directly.
- Where the session snapshots and run artifacts may be stored.

For most teams, the first automated version should create a reviewable draft and leave the merge decision to a person.

## Testing without model credentials

The repository’s unit tests do not call a model. They validate the local controls:

```bash
pytest
python scripts/check_docs.py
```

That separation matters. You can test path boundaries, allowed commands, prompt construction, and generated artifacts deterministically. Then run a small number of provider-backed tasks as integration tests.

## Use cases that fit this pattern

This tutorial uses documentation because the result is easy to inspect. The same harness pattern works when an agent has a clear job, constrained access, and an observable handoff:

- Investigate an operational alert and prepare a triage report.
- Turn approved release notes into documentation updates.
- Check a data-quality rule and prepare an exception summary.
- Gather evidence for a support response and draft it for review.
- Review a repository after a merge and suggest targeted follow-up work.

The important design move is to start from the outcome, then give the agent only the context and operations it needs to achieve that outcome.

## Production checklist

Before moving beyond a local experiment, answer these questions explicitly:

- Are inputs from users, issue comments, or fetched pages treated as untrusted data?
- Do tools enforce least privilege independently of the model’s instructions?
- Do write operations go through a review or approval point where needed?
- Are secrets excluded from prompts, logs, session data, and output artifacts?
- Are model, tool, and application events traced well enough to investigate failures?
- Are evaluations checking the job’s actual quality, not merely whether a tool was called?
- Do you have limits for time, token use, retries, and concurrent work?

Strands provides the agent runtime and extension points. Safe operation is still an application design responsibility.

## Repository map

```text
src/docs_agent/
  agent.py          # agent, model configuration, scoped tools, session manager
  run.py            # command-line entry point and run artifact writer
scripts/check_docs.py # deterministic local Markdown validation
skills/documentation/ # durable project-specific writing guidance
.github/workflows/    # manual CI starting point
tests/                # tests for local boundaries and documentation checks
```

## Learn more

- [Strands Agents documentation](https://strandsagents.com/)
- [Python SDK source](https://github.com/strands-agents/harness-sdk/tree/main/strands-py)
- [Session management](https://strandsagents.com/docs/user-guide/concepts/agents/session-management/)
- [Tools and safety guidance](https://strandsagents.com/docs/user-guide/safety-security/)

## License

This tutorial is licensed under the Apache License 2.0. See [LICENSE](LICENSE).
