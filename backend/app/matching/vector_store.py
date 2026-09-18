import json
import re
from typing import Any

import chromadb
from chromadb.config import Settings as ChromaSettings

from app.config import get_settings


class InMemoryVectorStore:
    """Deterministic lexical retrieval for tests and offline demos."""

    def __init__(self) -> None:
        self._clauses: list[dict[str, Any]] = []

    def ingest_clauses(self, clauses: list[dict[str, Any]]) -> None:
        self._clauses = list(clauses)

    def search(self, query: str, *, limit: int) -> list[dict[str, object]]:
        query_terms = _terms(query)
        scored: list[tuple[float, dict[str, object]]] = []
        for clause in self._clauses:
            haystack = " ".join(
                str(clause.get(key, ""))
                for key in ("scheme_name", "act_name", "section", "text", "eligibility_criteria")
            )
            clause_terms = _terms(haystack)
            score = len(query_terms & clause_terms) / max(1, len(query_terms))
            scored.append((score, {**clause, "score": score}))
        scored.sort(key=lambda item: item[0], reverse=True)
        return [hit for _, hit in scored[:limit]]


def _terms(text: str) -> set[str]:
    return {term for term in re.findall(r"[a-z0-9_]+", text.lower()) if len(term) > 2}


class ChromaAdapter:
    def __init__(self) -> None:
        settings = get_settings()
        self._client = chromadb.HttpClient(
            host=settings.chroma_host,
            port=settings.chroma_port,
            settings=ChromaSettings(anonymized_telemetry=False),
        )
        # Use cosine distance so score = 1 - distance
        self._collection = self._client.get_or_create_collection(
            name="scheme_clauses",
            metadata={"hnsw:space": "cosine"},
        )

    def ingest_clauses(self, clauses: list[dict[str, Any]]) -> None:
        """
        Ingest a list of clause dictionaries into ChromaDB.
        Expects keys: scheme_id, clause_id, act_name, section, text, eligibility_criteria (dict).
        """
        if not clauses:
            return

        ids = []
        documents = []
        metadatas = []

        for clause in clauses:
            ids.append(clause["clause_id"])
            documents.append(clause["text"])
            
            # Chroma metadata must be flat and contain only strings, ints, or floats
            meta = {
                "scheme_id": clause["scheme_id"],
                "clause_id": clause["clause_id"],
                "act_name": clause["act_name"],
                "section": clause["section"],
                "text": clause["text"],
            }
            # Serialize eligibility_criteria to JSON string so it can be stored in metadata
            criteria = clause.get("eligibility_criteria", {})
            meta["eligibility_criteria_json"] = json.dumps(criteria)
            
            metadatas.append(meta)

        self._collection.upsert(
            ids=ids,
            documents=documents,
            metadatas=metadatas,
        )

    def search(self, query: str, *, limit: int) -> list[dict[str, object]]:
        """Return raw clause hits with metadata and score."""
        results = self._collection.query(
            query_texts=[query],
            n_results=limit,
        )

        hits = []
        # Results is a dict with lists of lists (one list per query text)
        if not results["ids"] or not results["ids"][0]:
            return hits

        for i in range(len(results["ids"][0])):
            meta = results["metadatas"][0][i] or {}
            distance = results["distances"][0][i] if results["distances"] else 0.0
            
            hit = dict(meta)
            # Reconstruct eligibility_criteria from JSON string
            criteria_json = hit.pop("eligibility_criteria_json", "{}")
            try:
                hit["eligibility_criteria"] = json.loads(criteria_json)
            except (json.JSONDecodeError, TypeError):
                hit["eligibility_criteria"] = {}
                
            # Score = 1.0 - Cosine Distance
            hit["score"] = max(0.0, 1.0 - float(distance))
            hits.append(hit)

        return hits
