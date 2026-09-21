from scripts.check_docs import ROOT, local_links_are_valid


def test_repository_docs_have_valid_local_links() -> None:
    assert local_links_are_valid(ROOT / "README.md") == []
