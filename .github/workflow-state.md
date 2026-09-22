# Documentation workflow state

Strands harness owns memory extraction and retrieval. Actions preserves the files.

Before each docs task, `scripts/docs-memory.mjs restore` finds the newest successful
main-branch run of this workflow and downloads its `docs-memory-*` artifact. It
restores plain Markdown memory files into `.agent/memory/`. Expired or
missing artifacts mean a fresh start; a download failure fails the run rather
than silently discarding known state.

The feedback step collects new issue comments, submitted review bodies, and
inline review comments on this repository's GitHub-Actions-created docs PRs.
Only authors with current admin, maintain, or write access are included. The
feedback is passed to the agent as task context with instructions to distinguish
ongoing preferences from one-off corrections. Extraction remains model-driven:
we do not guarantee every comment becomes a memory.

After the agent flushes memory and independent checks pass, the workflow saves
memory plus processed-comment IDs for 90 days. Only successful workflow runs
are sources for future restoration. The workflow's shared concurrency group
prevents simultaneous writers. GitHub can replace pending runs in a concurrency
group; this is not a guaranteed queue for every incoming event.

Session snapshots are retained for 90 days. Comment `@docs-bot revise` followed
by feedback on an open docs-bot PR to resume its original session. The author
must currently have write, maintain or admin access. Manual workflow dispatch
also accepts `pr_number` and `feedback` for the same path.

The workflow loads trusted main-branch code, overlays only the PR's Markdown,
and restores the latest successful session associated with that PR's source
commit. The original ID is passed as `session: { id: process.env.DOCS_SESSION_ID }`
in .github/agents/docs-agent.ts. It refuses to silently start over when the saved session expired.
Checks run before a separate job updates the same PR branch and posts a summary.
Publishing refuses a stale PR head rather than overwriting concurrent edits.

New code-change tasks still start separate sessions and share repository memory.

The agent is not fine-tuned: remembered facts are retrieved into its context.
Check memories against current source. Past test results are historical evidence,
not proof that today's code passes. Files persist only while a retained artifact
is available; active runs refresh the snapshot, but 90 days of inactivity can
expire the repository's saved memory.

## One agent entry point

Both `npm start` and `npm run agent:docs` execute the `.github/agents/docs-agent.ts`.
It creates `docsAgent`, calls `docsAgent.invoke()`, and flushes
pending memory extraction. Local execution audits the checked-out repository;
Actions supplies a validated commit range and authorized review feedback.

`.github/agents/workflow-support.ts` only builds the prompt. The agent's
instructions and docs-maintainer skill ask it to write its final summary to
`run-output/agent-summary.md`, using its built-in file tool, and return it in the
response. There is no separate saveSummary/saveResult helper or custom metrics
recording. The patch validator requires a nonempty regular summary file before
publication, and uses it in the PR description or revision reply.

`run-output/` also holds the verified patch, review feedback, validation output
and state snapshots used by the workflow. Session artifacts are named
`docs-session-*`; memory artifacts are named `docs-memory-*`. Diagnostic `docs-run-*`
artifacts contain the summary and validation output without duplicating runtime
state. Strands harness handles native sessions and memory.
