# Use OpenAI, Anthropic, or OpenRouter

Choose one provider for your copy of the tutorial. You will edit the same
`.github/agents/docs-agent.ts` and `.github/workflows/docs.yml` files. The job,
skills, PR publishing, sessions, and memory persistence stay the same.

These instructions target the pinned `@strands-agents/harness@0.1.0` and
`@strands-agents/sdk@1.17.0`. Provider clients are optional dependencies:
install the one you need below. You do not need to replace Strands harness.

## 1. Choose a model and store your key

For **OpenAI or OpenRouter**, install the compatible OpenAI client:

```sh
npm install --save-exact openai@6.45.0
```

For **Anthropic**, install its compatible client:

```sh
npm install --save-exact @anthropic-ai/sdk@0.109.1
```

Commit both `package.json` and `package-lock.json`. GitHub Actions uses `npm ci`,
so a client installed only on your laptop will not be available to the runner.
These versions match the peer dependencies of the pinned Strands SDK.

Use a model available to your account that supports tool calling. For direct
OpenAI, choose a model supporting the Responses API and reasoning. For Anthropic,
choose a Claude model supporting extended/adaptive thinking. OpenRouter model
IDs include the upstream provider, such as `anthropic/…` or `openai/…`.

Set your own repository and the model ID from your provider's catalog:

```sh
export DOCS_REPO="YOUR-OWNER/YOUR-REPO"
gh variable set DOCS_MODEL_ID --repo "$DOCS_REPO" --body "YOUR_MODEL_ID"
```

Use the raw provider model ID in this variable. The code below adds the Strands
provider prefix for direct OpenAI or Anthropic.

| Provider | Create a key / choose a model | GitHub secret |
| --- | --- | --- |
| OpenAI directly | [API quickstart](https://developers.openai.com/api/docs/quickstart) | `OPENAI_API_KEY` |
| Anthropic directly | [Claude API overview](https://platform.claude.com/docs/en/api/overview) | `ANTHROPIC_API_KEY` |
| OpenRouter | [Quickstart and model catalog](https://openrouter.ai/docs/quickstart) | `OPENROUTER_API_KEY` |

Run **only the command for your provider**. `gh` prompts for the secret:

```sh
gh secret set OPENAI_API_KEY --repo "$DOCS_REPO"
```

```sh
gh secret set ANTHROPIC_API_KEY --repo "$DOCS_REPO"
```

```sh
gh secret set OPENROUTER_API_KEY --repo "$DOCS_REPO"
```

These are API credentials, not a subscription to a chat application. Usage is
billed through the provider whose key you use.

## 2. Configure the same agent

In `.github/agents/docs-agent.ts`, keep the existing imports. Read your model ID
and move the existing documentation instructions into a variable:

```ts
const modelId = process.env.DOCS_MODEL_ID
if (!modelId) throw new Error('Set DOCS_MODEL_ID to a model available to your provider account')

const instructions =
  'Use the docs-writing and humanize skills for documentation work. ' +
  'Review code changes, or audit the implementation if no diff is supplied. ' +
  'Create missing docs and update stale ones. Run every runnable example ' +
  'in the docs and run npm run docs:check. Fix documentation issues only. ' +
  'Report what passed, what failed, and anything you could not verify. ' +
  'Write that summary to run-output/agent-summary.md, then reply with it.'
```

Replace the existing `const docsAgent = await createHarness(...)` declaration
with **one** of the examples below. Each shows the model being passed directly
into the factory. Keep the existing `getTask()`, `invoke()`, and `flush()` code
after it.

### OpenAI

```ts
const model = `openai/${modelId}`

const docsAgent = await createHarness({
  model,
  effort: 'auto',
  builtinTools: { web_search: false },
  session: { id: process.env.DOCS_SESSION_ID },
  instructions,
})
```

The adapter reads `OPENAI_API_KEY` and uses the Responses API. Strands harness
configures reasoning for the selected model; prompt caching is handled by OpenAI.

### Anthropic

```ts
const model = `anthropic/${modelId}`

const docsAgent = await createHarness({
  model,
  effort: 'auto',
  builtinTools: { web_search: false },
  session: { id: process.env.DOCS_SESSION_ID },
  instructions,
})
```

The adapter reads `ANTHROPIC_API_KEY` and calls Anthropic directly. These calls
do not go through Bedrock. Strands harness configures thinking and cache points
for supported Claude models.

### OpenRouter

Add this import at the top of the file:

```ts
import { OpenAIModel } from '@strands-agents/sdk/models/openai'
```

Then create the model and pass it into `createHarness()`:

```ts
if (!process.env.OPENROUTER_API_KEY) throw new Error('Set OPENROUTER_API_KEY')
const model = new OpenAIModel({
  api: 'chat',
  modelId,
  apiKey: process.env.OPENROUTER_API_KEY,
  clientConfig: { baseURL: 'https://openrouter.ai/api/v1' },
})

const docsAgent = await createHarness({
  model,
  effort: 'auto',
  builtinTools: { web_search: false },
  session: { id: process.env.DOCS_SESSION_ID },
  instructions,
})
```

The pinned TypeScript package does not have an `openrouter/` factory prefix.
Instead, this uses its OpenAI-compatible Chat Completions adapter pointed at
OpenRouter. The `OpenAIModel` class name does not mean the request goes to OpenAI:
the endpoint, key, and model ID above determine where it goes.

Select a tool-capable OpenRouter model. This explicit model instance does not
automatically receive provider-specific reasoning or cache configuration from
Strands harness. Caching and reasoning behavior depend on the routed model and
any supported settings you add to the adapter.

### Reasoning and web search

`effort: 'auto'` selects the recommended reasoning setting for a provider string.
For an explicit model instance, such as the OpenRouter adapter, configure reasoning
on that instance if needed. If a directly selected model does not support
reasoning, use `effort: 'off'` instead.

This docs bot investigates files already in its checkout, so these variants
disable provider-native web search. File tools, shell, web fetching, skills,
sessions, and memory remain available.

## 3. Replace the Bedrock authentication in GitHub Actions

In `.github/workflows/docs.yml`:

1. Remove the **Check reader configuration** step that checks AWS variables.
2. Remove the **Configure short-lived Bedrock access** step.
3. Remove `AWS_REGION` from `jobs.investigate.env`.
4. Remove `id-token: write` from `jobs.investigate.permissions`. Keep its GitHub
   read permissions and the separate publisher's write permissions.
5. Replace **Investigate and update documentation** with the version below for
   your provider.

**OpenAI:**

```yaml
      - name: Investigate and update documentation
        env:
          DOCS_MODEL_ID: ${{ vars.DOCS_MODEL_ID }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        run: |
          test -n "$OPENAI_API_KEY" || { echo "::error::Set OPENAI_API_KEY."; exit 1; }
          npm run agent:docs
```

**Anthropic:**

```yaml
      - name: Investigate and update documentation
        env:
          DOCS_MODEL_ID: ${{ vars.DOCS_MODEL_ID }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          test -n "$ANTHROPIC_API_KEY" || { echo "::error::Set ANTHROPIC_API_KEY."; exit 1; }
          npm run agent:docs
```

**OpenRouter:**

```yaml
      - name: Investigate and update documentation
        env:
          DOCS_MODEL_ID: ${{ vars.DOCS_MODEL_ID }}
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
        run: |
          test -n "$OPENROUTER_API_KEY" || { echo "::error::Set OPENROUTER_API_KEY."; exit 1; }
          npm run agent:docs
```

Do not replace the entire workflow with this fragment. Keep task preparation,
session/memory restore and save, validation, and publication in their current order.
The key is supplied only to the agent step, not the publishing job.

You can skip the AWS setup guide entirely for these providers. You do still need
**Settings → Actions → General → Workflow permissions → Allow GitHub Actions
to create and approve pull requests** in your repository. Organization policy
must also permit it.

Run the checks:

```sh
npm run check
npm run docs:check
```

Commit and push your code, dependency, and workflow changes to `main` in your
GitHub repository. Then enable the bot:

```sh
gh variable set DOCS_AGENT_ENABLED --repo "$DOCS_REPO" --body "true"
```

Now follow [the sample code-change exercise](../README.md#4-merge-a-change-and-watch-the-bot-work).
Check both the initial docs PR and a revision. Adding a secret alone does not
change the model; the factory and workflow edits above are also required.

## Local run

After making the agent code changes, export `DOCS_MODEL_ID` and your selected
provider's API key in your terminal, then run `npm run agent:docs`. GitHub secrets
and variables are not automatically available on your laptop. This project does
not automatically load a `.env` file.

Keep keys out of source, prompts, and committed files.

## Background models and memory

The pinned package uses these defaults for memory extraction and web-page
summarization when a provider string is used:

| Main connection | Background model |
| --- | --- |
| Direct OpenAI | `gpt-5.6-luna` |
| Direct Anthropic | `claude-haiku-4-5-20251001` |
| OpenRouter through the model instance above | The same model instance |

Make sure your key can access the background model too. If it cannot, explicitly
choose an available background model through `builtinTools.web_fetch.model`.
That setting is also used by the default memory extractor. For example, to reuse
your selected model, replace the `builtinTools` option above with:

```ts
  builtinTools: {
    web_search: false,
    web_fetch: { model },
  },
```

This can increase background-call cost compared with a smaller model. It does
not change where session or memory files are saved: the GitHub workflow still
preserves them separately, as described in the README.

## Validation scope

The examples were checked against the installed package's provider constructors
and types. Construction and workflow syntax checks do not verify access, billing,
or task quality with your key. Run the tutorial exercises in your account before
depending on the bot. No live requests were made to these providers while adding
this guide.
