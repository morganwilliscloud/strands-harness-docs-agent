# Working with the documentation agent

Keep each task narrow enough that a reviewer can understand the requested outcome and verify it.

Good requests:

- “Update the install section after the command-line flag was renamed. Read the implementation first, then run the docs check.”
- “Add an example for the new output format. Do not alter any source code. Explain what you verified.”

Avoid requests that combine unrelated jobs, ask the agent to bypass repository controls, or include credentials. The agent can read project files, write Markdown under `docs/`, and run its named checks. Those boundaries are part of the example, not obstacles to work around.
