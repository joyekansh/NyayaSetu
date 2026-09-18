from pathlib import Path


def test_fixture_to_rag_pipeline_returns_grounded_match() -> None:
    from app.knowledge_base.ingest import flatten_active_clauses, load_scheme_fixture
    from app.matching.hybrid_matcher import HybridMatcher
    from app.matching.semantic_matcher import SemanticMatcher
    from app.matching.vector_store import InMemoryVectorStore

    fixture_path = Path(__file__).resolve().parents[1] / "app" / "knowledge_base" / "fixtures" / "nalsa_act_1987.json"
    clauses = flatten_active_clauses(load_scheme_fixture(fixture_path))
    vector_store = InMemoryVectorStore()
    vector_store.ingest_clauses(clauses)

    matches = HybridMatcher(semantic_matcher=SemanticMatcher(vector_store=vector_store)).match(
        case_fields={"category": "woman", "annual_income": 250000}
    )

    assert matches
    assert matches[0]["citation"].startswith("Legal Services Authorities Act, 1987")
    assert matches[0]["final_confidence"] > 0
    assert matches[0]["rule_outcome"] == "PASS"

