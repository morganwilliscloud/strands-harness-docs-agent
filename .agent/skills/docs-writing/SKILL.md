---
name: docs-writing
description: Write or revise developer documentation for verified application behavior, including quickstarts, task guides, CLI reference, and troubleshooting. Use when a code change affects instructions, examples, options, or expected output.
---

# Write useful developer documentation

Start with the reader's task and the changed behavior. Read the implementation
and existing documentation before deciding what needs to change. Preserve the
project's terminology and structure; update affected passages instead of
rewriting unrelated pages.

## Help the reader complete the task

- Put prerequisites and the working directory before commands that need them.
  Include only setup the example actually requires.
- Give the smallest complete, runnable example that demonstrates the behavior.
  Name inputs, show the command, and explain how to recognize success.
- Explain why a reader would choose an option. Use tables for comparable
  options, defaults, and accepted values; numbered steps for ordered actions.
- Keep task instructions separate from exhaustive reference material. Link to
  existing detail instead of duplicating it across pages.
- Document relevant failure cases with the actual error and a concrete remedy.
  Preserve distinctions such as stdout versus stderr and zero versus nonzero
  exit status.

## Ground every example

Use API names, flags, defaults, units, paths, and output fields from the checked
out implementation. Run examples with repository fixtures. Copy observed
output faithfully; label omissions and placeholders instead of presenting
invented output as a transcript.

Check how the change affects existing examples, help text, reference tables,
and local links. Preserve accurate descriptions of unchanged behavior.
If implementation and tests disagree, report the discrepancy instead of
quietly choosing the more convenient claim.

Use the repository's executable example convention where available. Examples
that intentionally fail belong in explanatory fences, not success-only checks.
An exit-code check alone does not prove that printed output matches the prose.

## Edit for comprehension

Use direct address, concrete verbs, and consistent names. Explain unfamiliar
terms when the reader needs them. Use descriptive, sentence-case headings
and short paragraphs that answer one question each.

Keep factual caveats that affect use. Avoid unsupported claims such as
"production-ready," "secure," "instant," or "works everywhere." Do not add
marketing language or invented personal experience.

After drafting, apply the sibling `humanize` skill to changed prose. Preserve
code, literal output, technical meaning, and the established documentation
voice. Finish by checking that the reader can follow the instructions with
the files and prerequisites actually available.
