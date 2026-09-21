from pathlib import Path

import pytest

from docs_agent.agent import ALLOWED_CHECKS, _safe_path, safe_session_id


def test_session_id_removes_path_characters() -> None:
    assert safe_session_id("../review pass") == "review-pass"


def test_path_cannot_escape_project() -> None:
    with pytest.raises(ValueError, match="inside this repository"):
        _safe_path("../../outside.md")


def test_write_path_must_stay_in_docs() -> None:
    with pytest.raises(ValueError, match="only inside docs"):
        _safe_path("README.md", allow_write=True)


def test_secret_environment_files_are_not_readable() -> None:
    with pytest.raises(ValueError, match="not available"):
        _safe_path(".env")


def test_docs_write_path_is_allowed() -> None:
    result = _safe_path("docs/example.md", allow_write=True)
    assert result == Path(__file__).resolve().parents[1] / "docs" / "example.md"


def test_checks_are_explicit() -> None:
    assert set(ALLOWED_CHECKS) == {"docs", "tests"}
