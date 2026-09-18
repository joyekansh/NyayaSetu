# NyayaSetu Backend API Contract

Base path: `/api/v1`

All endpoints return JSON. Error responses use FastAPI's stable `{"detail": "..."}` shape.

## Health

`GET /health`

Returns:

```json
{"status": "ok"}
```

## Citizen Intake

`POST /cases`

Body:

```json
{
  "language": "en",
  "consent_given": true,
  "district": "Lucknow",
  "intake_answers": {}
}
```

Returns `201` with case summary:

```json
{
  "id": "uuid",
  "status": "RECEIVED",
  "urgency_tier": null,
  "urgency_score": null,
  "language": "en"
}
```

`POST /cases/{case_id}/documents`

Multipart form:

- `file`: PDF, PNG, JPG, or JPEG
- `doc_type`: `income_cert`, `income_certificate`, `eviction_notice`, `aadhaar`

Validation:

- rejects empty files
- rejects unsafe filenames
- checks magic bytes
- checks extension matches content
- computes SHA-256 checksum server-side

Returns `201`:

```json
{
  "id": "uuid",
  "case_id": "uuid",
  "document_type": "INCOME_CERTIFICATE",
  "ocr_status": "PENDING",
  "checksum": "sha256"
}
```

## Matching

`GET /cases/{case_id}/matches`

Server-side gate is enforced before matcher invocation.

Responses:

- `404`: case not found
- `403`: `{"detail": "OPERATOR_RELEASE_REQUIRED"}` for `HIGH` or `CRITICAL` cases without release
- `200`: provenance-bearing matches

```json
{
  "matches": [
    {
      "scheme_id": "nalsa-free-legal-aid",
      "clause_id": "lsa-1987-s12-c",
      "citation": "Legal Services Authorities Act, 1987, Section 12(c)",
      "clause_text": "...",
      "semantic_score": 0.8,
      "rule_outcome": "PASS",
      "rule_reasons": [],
      "final_confidence": 0.8
    }
  ]
}
```

## Operator

Operator endpoints require `X-User-Id` for a user with role `CASEWORKER`, `ADVOCATE`, or `ADMIN`.

`GET /operator/queue`

Returns high/critical cases:

```json
{
  "cases": [
    {
      "id": "uuid",
      "status": "TRIAGED",
      "urgency_tier": "CRITICAL",
      "urgency_score": 40.0
    }
  ]
}
```

`POST /operator/cases/{case_id}/release`

Body:

```json
{"reason": "Reviewed urgency evidence"}
```

Effect:

- moves case to `IN_REVIEW`
- appends `GATE_RELEASED` audit event

Returns:

```json
{"status": "IN_REVIEW"}
```

