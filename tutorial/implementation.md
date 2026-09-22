# Implementation provenance

This tutorial ports the TypeScript implementation used by the Request Report
documentation bot. The source snapshot is commit
`8b4d3b3a5b2d946f70cf7a25d511dc63f4ae20d2`.

The agent entry point and task helper are copied unchanged. The app, application
tests, documentation checker, patch validator, publisher, and writing skills are
also carried over. The maintainer skill is adjusted for a tutorial README.

Changes for reuse:

- Use published `@strands-agents/harness@0.1.0` instead of a vendored development build.
- Generate reader-specific IAM policies into a gitignored directory.
- Require explicit enablement before automatic model calls.
- Remove recording-reset configuration and old artifact migration fallbacks.
- Keep separate session and memory artifacts without duplicating both in diagnostics.
- Add setup, adaptation, and first-change instructions.

The published package defaults to Opus 5 on Bedrock. The recorded development
version used Opus 4.8. No model is hardcoded in the agent entry point.

## Validation

`npm run check`, `npm test`, and `npm run docs:check` validate the TypeScript,
sample application, documentation commands, and workflow helper behavior without
calling a model.

The port passed 20 tests, three executable documentation commands, and workflow
syntax validation. The first-change exercise was applied in a separate fresh
directory: `--version` returned `1.0.0` and all 21 tests passed.

The persistence test uses the published factory with deterministic model
responses. It checks automatic skill discovery, native session snapshot saving,
resumption in a fresh directory, and memory retrieval by a different session
without importing the previous conversation. It does not test Bedrock quality,
network access, or GitHub OIDC credentials.

The source demo ran with Bedrock and produced documentation PRs and same-session
revisions. That historical result is not proof of model access or OIDC setup in
a reader's new account. Follow the setup guide and complete both exercises to
verify your deployment.

This tutorial does not include benchmark measurements for the documentation task.
