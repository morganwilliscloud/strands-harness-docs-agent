"""Command-line entry point for the tutorial documentation agent."""

from __future__ import annotations

import argparse
from datetime import UTC, datetime
from pathlib import Path

from docs_agent.agent import build_agent, project_root


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the Strands documentation agent.")
    parser.add_argument("--task", required=True, help="A focused documentation request.")
    parser.add_argument(
        "--session-id",
        default="local-docs-agent",
        help="Conversation identifier to start or continue.",
    )
    return parser.parse_args()


def write_run_artifact(*, task: str, session_id: str, response: object) -> Path:
    """Write a reviewable local record outside the agent's writable docs boundary."""
    artifact_dir = project_root() / "artifacts"
    artifact_dir.mkdir(exist_ok=True)
    artifact = artifact_dir / "last-run.md"
    timestamp = datetime.now(UTC).isoformat()
    artifact.write_text(
        f"""# Documentation agent run

## Request

{task}

## Session

`{session_id}`

## Started

`{timestamp}`

## Agent response

{response}
""",
        encoding="utf-8",
    )
    return artifact


def main() -> None:
    args = parse_args()
    agent = build_agent(args.session_id)
    response = agent(args.task)
    artifact = write_run_artifact(
        task=args.task,
        session_id=args.session_id,
        response=response,
    )
    print(f"\nRun record written to {artifact.relative_to(project_root())}")


if __name__ == "__main__":
    main()
