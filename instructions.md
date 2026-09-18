# NyayaSetu Backend + Docker Handoff

This is the current handoff for Riya's Backend + Docker workload on branch `feat/backend-docker-foundation`.

Do not treat this as a product README. This is an engineering pickup guide: what is built, what is left, what is required, and exactly where to continue.

## Current Status

Overall backend/Docker completion: about **82%**.

The project is now demo-ready for the core backend differentiator flow:

```text
secure intake
  -> document persistence
  -> extraction task foundation
  -> deterministic urgency scoring
  -> hard match gate
  -> statutory fixture validation/loading
  -> rule + semantic + hybrid matching foundation
  -> guarded match endpoint
  -> operator queue + release
  -> audit events
  -> Docker/Nginx/CI foundation
```

It is not yet production-complete. The remaining work is mostly deeper persistence, real Chroma/OCR integration, complete operator decisions/referrals, and deployment hardening.

## Latest Verified State

Latest local commit:

```text
125546f chore: add backend ci contract and seed fixture
```

Most recent verification:

```powershell
docker build -q -t nyayasetu-backend-test:final backend
docker run --rm nyayasetu-backend-test:final python -m pytest -q -p no:cacheprovider
```

Result:

```text
115 passed, 3 warnings
```

Compose validation:

```powershell
$env:POSTGRES_DB='nyayasetu'
$env:POSTGRES_USER='nyayasetu'
$env:POSTGRES_PASSWORD='nyayasetu'
docker compose config
```

Result: passed.

The warnings are FastAPI/Starlette TestClient deprecations and one Starlette status-name deprecation. They are not NyayaSetu application failures.

## Completion Percentages

| Workstream | Complete | Left |
| --- | ---: | ---: |
| FastAPI app bootstrap + health | 95% | 5% |
| DB sessions + core models | 85% | 15% |
| Alembic baseline | 60% | 40% |
| Secure intake validation | 90% | 10% |
| Intake routes/storage/service | 85% | 15% |
| OCR/extraction pipeline | 70% | 30% |
| Urgency scorer + hard gate | 90% | 10% |
| Audit ledger | 80% | 20% |
| Knowledge fixture schema/loader | 80% | 20% |
| Rule matcher | 90% | 10% |
| Semantic + hybrid matcher | 75% | 25% |
| Guarded match endpoint | 80% | 20% |
| Operator queue/release workflow | 55% | 45% |
| Docker Compose + Nginx | 75% | 25% |
| CI workflow | 65% | 35% |
| API contract docs | 75% | 25% |

## What Is Implemented

### 1. FastAPI App

Files:

- `backend/app/main.py`
- `backend/app/config.py`
- `backend/app/db.py`
- `backend/tests/test_health.py`
- `backend/tests/test_db.py`

Implemented:

- FastAPI app factory.
- `/api/v1/health`.
- Pydantic settings.
- Database engine/session helpers.
- Router wiring for intake, matching, and operator routes.

Still needed:

- Better app-level exception normalization if the frontend wants a stricter error shape.
- CORS configuration for deployed frontend origin.

### 2. Core Models and Persistence

Files:

- `backend/app/models/base.py`
- `backend/app/models/user.py`
- `backend/app/models/case.py`
- `backend/app/models/case_record.py`
- `backend/app/models/document.py`
- `backend/app/models/extracted_field.py`
- `backend/app/models/audit_event.py`
- `backend/alembic/versions/0001_initial_schema.py`

Implemented:

- `User` with role enum.
- `CaseRecord` with status, urgency tier, urgency score, language, timestamps.
- `Document` with type, OCR status, storage key, checksum, uploader, content type.
- `ExtractedField` with confidence bounds.
- `AuditEvent` with sequence and hash-chain fields.
- Alembic baseline migration.

Still needed:

- Models for `scheme_clauses`.
- Models for `scheme_matches`.
- Models for operator decisions/referrals if referrals become persistent.
- Alembic migration updates for those new models.

### 3. Audit Ledger

Files:

- `backend/app/audit_ledger.py`
- `backend/tests/test_audit_ledger.py`

Implemented:

- Canonical JSON event hashing.
- Case-local append sequence.
- Previous-hash chaining.
- Insert-only repository API.
- Audit tests.

Still needed:

- Postgres role-level denial of `UPDATE`/`DELETE` on `audit_events`.
- Row locking/concurrency safety for simultaneous appends to the same case.
- Dedicated read-only audit route if operator UI needs timeline API.

### 4. Intake

Files:

- `backend/app/intake/schemas.py`
- `backend/app/intake/storage.py`
- `backend/app/intake/service.py`
- `backend/app/intake/router.py`
- `backend/tests/test_intake_schemas.py`
- `backend/tests/test_intake_storage.py`
- `backend/tests/test_intake_service.py`
- `backend/tests/test_intake_router.py`

Implemented:

- Safe filename checks.
- Empty file rejection.
- Max size validation.
- Magic-byte detection for PDF/PNG/JPEG.
- Extension/content mismatch rejection.
- SHA-256 checksum computation.
- Local durable storage adapter.
- Case creation route.
- Document upload route.
- Audit event for document upload.
- Celery enqueue after DB commit.

Still needed:

- Duplicate document policy.
- Configurable upload size from settings.
- Real authentication instead of `X-User-Id` demo dependency.
- More nuanced status endpoint for citizen frontend.

### 5. Extraction Pipeline

Files:

- `backend/app/extraction/ocr_engine.py`
- `backend/app/extraction/parser_factory.py`
- `backend/app/extraction/tasks.py`
- `backend/app/extraction/schemas.py`
- `backend/app/extraction/parsers/base.py`
- `backend/app/extraction/parsers/income_cert.py`
- `backend/app/extraction/parsers/eviction_notice.py`
- `backend/app/document_processing.py`
- `backend/app/celery_app.py`
- `backend/tests/test_extraction.py`
- `backend/tests/test_extraction_task.py`
- `backend/tests/test_celery_lifecycle.py`

Implemented:

- OCR strategy protocol.
- Fake OCR strategy for deterministic tests.
- Parser factory.
- Income certificate parser.
- Eviction notice parser.
- Extracted field persistence in extraction processor.
- OCR started/completed/failed audit events.
- Triage scoring after extraction.
- Celery app configured with Redis URL.
- Processing lifecycle transition helper.

Still needed:

- Real Tesseract or Vision API strategy.
- Hindi labels with correctly encoded fixtures/tests.
- Aadhaar parser.
- Retry/backoff policy on actual Celery task.
- Better failure classifications for OCR/parser/storage failures.

### 6. Triage and Hard Gate

Files:

- `backend/app/triage/schemas.py`
- `backend/app/triage/urgency_checks.py`
- `backend/app/triage/scorer.py`
- `backend/app/triage/gate.py`
- `backend/app/triage/urgency_context.py`
- `backend/tests/test_urgency_gate.py`

Implemented:

- Deterministic urgency signals.
- Tier boundaries.
- Malformed input safety.
- Duplicate trigger deduplication.
- HIGH/CRITICAL match gate.
- Explicit operator release object.
- Urgency context builder from extracted fields.

Still needed:

- Persisted operator release object, not just route/audit event.
- More intake-answer integration into urgency scoring.
- Stronger route-level tests after real matching persistence is added.

### 7. Knowledge Base

Files:

- `backend/app/knowledge_base/schemas.py`
- `backend/app/knowledge_base/ingest.py`
- `backend/app/knowledge_base/fixtures/nalsa_act_1987.json`
- `backend/tests/test_knowledge_fixtures.py`
- `backend/tests/test_knowledge_ingest.py`

Implemented:

- Statutory fixture schema.
- Clause-level provenance requirements.
- Duplicate clause ID rejection.
- Fixture JSON loader.
- Active-clause flattener.
- Seed NALSA Legal Services Authorities Act fixture.
- Bundled fixture validation test.

Still needed:

- More statutory fixtures:
  - victim compensation scheme
  - BOCW welfare board rules
  - state-specific scheme variants
- DB-backed ingestion into `scheme_clauses`.
- Chroma ingestion with embeddings.
- Fixture versioning and inactive clause rules in persistence.

### 8. Matching

Files:

- `backend/app/matching/rule_matcher.py`
- `backend/app/matching/semantic_matcher.py`
- `backend/app/matching/hybrid_matcher.py`
- `backend/app/matching/router.py`
- `backend/tests/test_rule_matcher.py`
- `backend/tests/test_semantic_hybrid_matcher.py`
- `backend/tests/test_guarded_matching.py`
- `backend/tests/test_matching_router.py`

Implemented:

- Deterministic rule matcher:
  - `equals`
  - `in`
  - `lte`
  - `gte`
  - `exists`
  - `all`
  - `any`
  - missing fields become `UNKNOWN`
- Semantic matcher skeleton with vector-store protocol.
- Clause-level retrieval result.
- Hybrid matcher combining semantic score and rule result.
- Guarded matcher boundary.
- `/api/v1/cases/{case_id}/matches` route.
- Gate checked before matcher invocation.

Still needed:

- Real Chroma adapter.
- DB-backed matcher dependency.
- Case extracted-field loading into matcher route.
- Persistence of generated matches.
- Threshold filtering and match ordering.
- Ragas/retrieval faithfulness tests.

### 9. Operator Workflow

Files:

- `backend/app/operator/router.py`
- `backend/tests/test_operator_router.py`

Implemented:

- Operator role enforcement.
- `GET /api/v1/operator/queue`.
- HIGH/CRITICAL queue filtering.
- `POST /api/v1/operator/cases/{case_id}/release`.
- Case moves to `IN_REVIEW`.
- `GATE_RELEASED` audit event.

Still needed:

- Field correction endpoint.
- Match approve/reject/override endpoint.
- Referral generation.
- Referral PDF or structured referral artifact.
- Operator decision persistence.
- Audit timeline endpoint.
- Idempotency rules for repeated decisions.

### 10. Docker, Nginx, CI

Files:

- `docker-compose.yml`
- `docker-compose.prod.yml`
- `backend/Dockerfile`
- `infra/Dockerfile.backend`
- `worker/Dockerfile`
- `nginx/nginx.conf`
- `infra/github-actions/deploy.yml`

Implemented:

- Compose services for Postgres, Redis, Chroma, backend, worker, Nginx.
- Nginx reverse proxy for `/api/`.
- Production override with restart/read-only settings for backend/worker.
- Backend CI workflow that builds image, runs tests, validates compose.

Still needed:

- Full `docker compose up --build` smoke test.
- EC2 deployment script/SSH workflow.
- GitHub secrets setup.
- TLS/Certbot setup.
- Runtime volume for document storage if local storage is used in deployment.
- Proper frontend service integration once frontend is in final shape.

### 11. API Contract

Files:

- `docs/backend-api-contract.md`

Implemented:

- Health contract.
- Case creation contract.
- Document upload contract.
- Matching response/blocked response contract.
- Operator queue/release contract.

Still needed:

- Add operator decision/referral contracts after endpoints are implemented.
- Add citizen status/dossier contracts if frontend depends on them.

## What Is Required To Run Locally

Required tools:

- Docker Engine
- Docker Compose v2
- Git

Backend dependencies are installed inside Docker from:

```text
backend/requirements.txt
```

Important env vars for Compose:

```text
POSTGRES_DB=nyayasetu
POSTGRES_USER=nyayasetu
POSTGRES_PASSWORD=nyayasetu
```

Optional:

```text
APP_ENVIRONMENT=development
NGINX_PORT=8080
```

## How To Verify Current State

From repo root:

```powershell
docker build -q -t nyayasetu-backend-test:local backend
docker run --rm nyayasetu-backend-test:local python -m pytest -q -p no:cacheprovider
```

Expected:

```text
115 passed, 3 warnings
```

Compose config validation:

```powershell
$env:POSTGRES_DB='nyayasetu'
$env:POSTGRES_USER='nyayasetu'
$env:POSTGRES_PASSWORD='nyayasetu'
docker compose config
```

Expected: exits `0`.

## Where To Pick Up Next

Recommended next sequence:

### Step 1: Persist statutory clauses

Goal: make knowledge fixtures real database data.

Add:

- `backend/app/models/scheme_clause.py`
- Alembic migration for `scheme_clauses`
- Ingest helper that writes flattened active clauses to Postgres
- Tests for versioning, inactive exclusion, duplicate clause protection

Why first:

Matching currently uses fake/vector protocol and JSON fixture loading. Persisted clauses are the bridge to real matching.

### Step 2: Wire real Chroma adapter

Goal: replace fake vector behavior with real Chroma integration.

Add:

- `backend/app/matching/vector_store.py`
- Chroma client wrapper using `CHROMA_HOST` / `CHROMA_PORT`
- Ingestion method from `SchemeClauseFixture`
- Search method returning clause metadata
- Fake adapter tests plus optional integration smoke test

Keep Chroma behind a protocol so tests stay deterministic.

### Step 3: DB-backed matching route

Goal: make `/cases/{case_id}/matches` use extracted fields and real matcher dependency.

Add:

- Query extracted fields for all case documents
- Convert to `case_fields`
- Inject real `HybridMatcher`
- Threshold/sort results
- Optional persistence to `scheme_matches`

Important:

The gate must remain before vector/matcher invocation.

### Step 4: Operator decisions and referral

Goal: finish paralegal workflow.

Add:

- `POST /operator/cases/{case_id}/matches/{match_id}/approve`
- `POST /operator/cases/{case_id}/matches/{match_id}/reject`
- `POST /operator/cases/{case_id}/referral`
- Audit events:
  - `FIELD_CORRECTED`
  - `MATCH_APPROVED`
  - `MATCH_REJECTED`
  - `REFERRAL_CREATED`
- Optional referral PDF generator.

### Step 5: Production hardening

Goal: make VM deployment credible.

Do:

- Run full `docker compose up --build` health check.
- Add document storage volume.
- Add Nginx TLS/Certbot instructions.
- Add GitHub Action deployment step using SSH secrets.
- Harden Postgres audit permissions.

## Risk Register

High risk:

- Real Chroma integration is not implemented.
- Full operator approval/referral flow is not implemented.
- Real OCR provider is not implemented.

Medium risk:

- Audit immutability is application-enforced, not fully DB-role-enforced yet.
- Matching route currently has the correct gate boundary but still needs real DB-backed matcher dependency.
- Docker Compose is config-validated but not fully smoke-tested with running containers in this final state.

Low risk:

- Intake validation is well covered.
- Rule matching is deterministic and tested.
- Triage gate is tested.
- Fixture schema validation is tested.
- Operator queue/release foundation is tested.

## Current Commit Trail

Recent important commits:

```text
125546f chore: add backend ci contract and seed fixture
e2df21d chore: wire nginx reverse proxy
c657363 feat: add operator review queue and release
628ee44 feat: load statutory knowledge fixtures
a679e7b feat: expose guarded match endpoint
23fbcf6 feat: add semantic hybrid matcher
619dd4d feat: add deterministic rule matcher
1bd66ff feat: add guarded matching boundary
13042c3 feat: validate statutory knowledge fixtures
c39e165 feat: wire intake routes and extraction processing
```

## Notes For Riya

Your backend is no longer just a scaffold. The main differentiator is represented in code:

- statutory matching is structured, not chatty
- recommendations carry clause provenance
- rule matching is deterministic
- high-risk cases are gated server-side
- operator release writes audit events
- ingestion and CI foundations exist

If time is tight for a demo, focus on:

1. One clean fixture.
2. One standard case returning one match.
3. One high-risk case blocked from matching.
4. Operator release showing audit.

That demo path is the strongest story for NyayaSetu.

