"""Small deterministic documentation check used by the tutorial agent."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MARKDOWN_LINK = re.compile(r"\[[^\]]+\]\(([^)]+)\)")


def local_links_are_valid(markdown_file: Path) -> list[str]:
    """Return problems for relative Markdown links in one file."""
    errors: list[str] = []
    content = markdown_file.read_text(encoding="utf-8")
    for destination in MARKDOWN_LINK.findall(content):
        if (
            destination.startswith(("http://", "https://", "#", "mailto:"))
            or "://" in destination
        ):
            continue
        relative_target = destination.split("#", maxsplit=1)[0]
        if not relative_target:
            continue
        target = (markdown_file.parent / relative_target).resolve()
        if not target.is_file():
            errors.append(
                f"{markdown_file.relative_to(ROOT)} links to missing file {destination!r}"
            )
    return errors


def main() -> int:
    markdown_files = [ROOT / "README.md", *sorted((ROOT / "docs").glob("**/*.md"))]
    errors = [
        error
        for markdown_file in markdown_files
        if markdown_file.is_file()
        for error in local_links_are_valid(markdown_file)
    ]
    if errors:
        print("\n".join(errors))
        return 1
    print(f"Documentation check passed for {len(markdown_files)} Markdown file(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
