from app.matching.rule_matcher import MatchOutcome, RuleMatchResult


class FakeVectorStore:
    def search(self, query: str, *, limit: int) -> list[dict[str, object]]:
        assert "income" in query
        assert limit == 5
        return [
            {
                "clause_id": "lsa-1987-s12-c",
                "scheme_id": "nalsa",
                "act_name": "Legal Services Authorities Act, 1987",
                "section": "12(c)",
                "text": "Women and children are eligible for legal services.",
                "score": 0.8,
                "eligibility_criteria": {"category": {"in": ["woman", "child"]}},
            }
        ]


def test_semantic_matcher_returns_clause_level_metadata() -> None:
    from app.matching.semantic_matcher import SemanticMatcher

    result = SemanticMatcher(vector_store=FakeVectorStore()).match({"income": 250000, "category": "woman"})

    assert result[0].citation == "Legal Services Authorities Act, 1987, Section 12(c)"
    assert result[0].semantic_score == 0.8


def test_hybrid_matcher_combines_semantic_and_rule_scores() -> None:
    from app.matching.hybrid_matcher import HybridMatcher
    from app.matching.semantic_matcher import RetrievedClause

    class Semantic:
        def match(self, case_fields: dict[str, object], *, limit: int = 5) -> list[RetrievedClause]:
            return [
                RetrievedClause(
                    scheme_id="nalsa",
                    clause_id="clause-1",
                    act_name="Act",
                    section="12",
                    text="Clause text",
                    semantic_score=0.8,
                    eligibility_criteria={"category": {"equals": "woman"}},
                )
            ]

    result = HybridMatcher(semantic_matcher=Semantic()).match(case_fields={"category": "woman"})

    assert result[0]["final_confidence"] == 0.8
    assert result[0]["rule_outcome"] == MatchOutcome.PASS.value
    assert result[0]["citation"] == "Act, Section 12"


def test_hybrid_matcher_discounts_unknown_rules() -> None:
    from app.matching.hybrid_matcher import HybridMatcher
    from app.matching.semantic_matcher import RetrievedClause

    class Semantic:
        def match(self, case_fields: dict[str, object], *, limit: int = 5) -> list[RetrievedClause]:
            return [
                RetrievedClause(
                    scheme_id="nalsa",
                    clause_id="clause-1",
                    act_name="Act",
                    section="12",
                    text="Clause text",
                    semantic_score=0.8,
                    eligibility_criteria={"income": {"lte": 300000}},
                )
            ]

    result = HybridMatcher(semantic_matcher=Semantic()).match(case_fields={})

    assert result[0]["final_confidence"] == 0.4
    assert result[0]["rule_outcome"] == RuleMatchResult(MatchOutcome.UNKNOWN).outcome.value

