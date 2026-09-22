---
name: humanize
description: Edit documentation and other prose to remove formulaic AI writing patterns while preserving technical meaning, factual claims, and the author's voice. Use for a final style pass on changed documentation.
---

# Humanize

Read [editing patterns](references/editing-patterns.md) before editing. Review
the text semantically, including sentence and paragraph rhythm. A word match
alone does not establish a problem.

Default to fixing changed prose. For an explicit scan request, report useful
findings without changing the text. Avoid unrelated rewrites or forced edits
when the original wording is already clear.

Preserve the author's meaning, certainty, factual claims, and quotations.
Leave working code, command lines, API identifiers, output, and literal strings
intact. Never invent experiences, opinions, measurements, or evidence to give
the writing personality.

For this project's documentation, use a direct, warm, developer-to-developer
voice. Prefer concrete verbs and consistent technical terms. Keep instructions
scannable; useful steps, option tables, and repeated identifiers are not defects.
Do not turn reference documentation into a first-person essay or sales pitch.

Remove unsupported praise, staged contrasts, dramatic reveals, throat-clearing,
and conclusions that repeat the preceding paragraph. Avoid em dashes in authored
prose while preserving literal syntax and quotations. Explain why the reader
would do something instead of narrating what an adjacent code block says.

After rewriting, reread for synonym cycling, identical paragraph openings,
uniform paragraph sizes, and changes in technical meaning. Keep necessary
attribution and uncertainty. If an edit would change meaning, retain the
original or flag the choice.
