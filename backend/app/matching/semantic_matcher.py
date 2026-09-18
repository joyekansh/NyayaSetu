from dataclasses import dataclass, field
from typing import Protocol


class VectorStore(Protocol):
    def search(self, query: str, *, limit: int) -> list[dict[str, object]]:
        """Return raw clause hits with metadata and score."""


@dataclass(frozen=True)
class RetrievedClause:
    scheme_id: str
    clause_id: str
    act_name: str
    section: str
    text: str
    semantic_score: float
    eligibility_criteria: dict[str, object] = field(default_factory=dict)

    @property
    def citation(self) -> str:
        return f"{self.act_name}, Section {self.section}"


class SemanticMatcher:
    def __init__(self, *, vector_store: VectorStore) -> None:
        self._vector_store = vector_store

    def match(self, case_fields: dict[str, object], *, limit: int = 5) -> list[RetrievedClause]:
        query = _case_summary(case_fields)
        hits = self._vector_store.search(query, limit=limit)
        return [_hit_to_clause(hit) for hit in hits]


def _case_summary(case_fields: dict[str, object]) -> str:
    return " ".join(f"{key}: {value}" for key, value in sorted(case_fields.items()))


def _hit_to_clause(hit: dict[str, object]) -> RetrievedClause:
    score = hit.get("score", 0.0)
    bounded_score = min(1.0, max(0.0, float(score) if isinstance(score, (int, float)) else 0.0))
    criteria = hit.get("eligibility_criteria")
    return RetrievedClause(
        scheme_id=str(hit["scheme_id"]),
        clause_id=str(hit["clause_id"]),
        act_name=str(hit["act_name"]),
        section=str(hit["section"]),
        text=str(hit["text"]),
        semantic_score=bounded_score,
        eligibility_criteria=criteria if isinstance(criteria, dict) else {},
    )

