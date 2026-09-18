# NyayaSetu Backend + Docker Handoff Instructions

This document is the working handoff for Riya's backend + Docker ownership area. It captures what has been built, how it is currently implemented, what remains, approximate completion percentages, and the safest way to continue from the present branch.

Current branch: `feat/backend-docker-foundation`

Do not push from this branch unless explicitly told to. Keep using small local commits after each verified slice.

## 1. Scope Riya Owns

Riya's workload is the backend foundation and deployment substrate for NyayaSetu:

- FastAPI modular monolith under `backend/app/`
- Core persistence and constrained lifecycle models
- PostgreSQL schema and Alembic migrations
- Append-only audit ledger
- Deterministic urgency scoring and hard human-in-the-loop gate
- Secure intake validation and document persistence
- OCR/parser foundation and Celery/Redis processing lifecycle
- Knowledge-base fixture validation
- Hybrid statutory matching with Chroma integration
- Guarded match endpoint
- Docker Compose, production overrides, and container hardening
- Backend integration tests, migration tests, and CI/security checks

The highest-risk ownership item is still the human-in-the-loop gate. The rule is simple: if a case is `HIGH` or `CRITICAL`, backend code must not expose statutory matches until an authorized operator releases it. This must remain server-side, not frontend-only.

## 2. Current Implementation Summary

Overall backend/Docker workload status: about 52 percent implemented.

This number means the foundations are strong, tested, and locally committed, but the full end-to-end pipeline is not finished yet. The backend currently has persistence, audit, triage gate, secure intake validation, parser foundations, Celery config, lifecycle helpers, Docker Compose basics, and Alembic baseline. It does not yet have full routers, real OCR execution, extracted-field persistence from jobs, knowledge-base ingestion, matching routes, operator release workflow, Nginx config, CI, or full container smoke verification.

### Completion by Workstream

| Workstream | Status | Percent |
| --- | --- | ---: |
| Core persistence: case model, constrained lifecycle, DB sessions | Implemented foundation | 85% |
| Audit ledger: hash chain and append-only repository boundary | Implemented foundation | 80% |
| Deterministic urgency scorer and hard gate | Implemented foundation | 75% |
| Secure intake validation | Implemented foundation | 70% |
| Intake persistence service | Implemented first service slice | 55% |
| OCR, parsers, Celery/Redis job pipeline | Parser/config/lifecycle foundation only | 40% |
| Knowledge-base fixture validation | Not yet implemented in current branch | 10% |
| Hybrid matching, Chroma integration, guarded match endpoint | Not yet implemented in app code | 10% |
| Docker Compose, production override, container hardening | Foundation present, not fully smoked | 55% |
| Alembic migrations, integration tests, CI/security check | Alembic baseline present; CI/security pending | 45% |

## 3. Local Commit Timeline

The important local commits on the current branch are:

- `9debf74` - bootstrapped backend health foundation
- `ad8f288` - ignored Python test caches
- `1a4070c` - added constrained case persistence model
- `5e80897` - ignored local worktrees
- `4ee076c` - added settings-driven database sessions
- `5bd4644` - added secure Docker Compose foundation
- `6bc2548` - added append-only audit ledger foundation
- `fcab89c` - added deterministic urgency gate
- `0d62b7d` - added core document data models
- `21000ac` - added Alembic baseline migration
- `f408df9` - aligned baseline migration with core models
- `0e22b12` - added secure intake and extraction pipeline foundation
- `d820b6e` - persisted secure intake submissions

Nothing has been pushed.

## 4. What Has Been Implemented

### 4.1 Backend App Bootstrap

Files:

- `backend/app/main.py`
- `backend/app/config.py`
- `backend/app/db.py`
- `backend/requirements.txt`
- `backend/tests/test_health.py`
- `backend/tests/test_db.py`

Current behavior:

- FastAPI app factory exists.
- API prefix is `/api/v1`.
- Health endpoint exists at `/api/v1/health`.
- Settings are Pydantic-based and environment driven.
- Database session factory helpers exist.
- `redis_url` was added for Celery.

What to remember:

- Settings are intentionally small right now.
- Add new external service settings here, not scattered through task modules.

### 4.2 Core Persistence Models

Files:

- `backend/app/models/base.py`
- `backend/app/models/case.py`
- `backend/app/models/case_record.py`
- `backend/app/models/user.py`
- `backend/app/models/document.py`
- `backend/app/models/extracted_field.py`
- `backend/app/models/audit_event.py`
- `backend/tests/test_case_model.py`
- `backend/tests/test_case_schema.py`
- `backend/tests/test_core_models.py`

Current behavior:

- `CaseRecord` stores case status, urgency tier, urgency score, language, and timestamps.
- `Document` stores document type, OCR status, storage key, checksum, content type, uploader, and case relation.
- `User` stores role and basic identity fields.
- `ExtractedField` exists for structured extracted data.
- Enums constrain status/type/tier values.

Important limitations:

- The lifecycle is constrained at the model/test level, but not yet fully enforced by all service methods because many routes/services are still pending.
- No citizen or operator routers are wired yet.

### 4.3 Alembic Baseline

Files:

- `backend/alembic.ini`
- `backend/alembic/env.py`
- `backend/alembic/versions/0001_initial_schema.py`
- `backend/tests/test_alembic_migrations.py`

Current behavior:

- Baseline migration creates current core tables.
- SQLite migration round-trip was previously verified.
- Migration aligns with the current model set.

Pickup notes:

- Any new model used by persisted services must update the Alembic migration chain.
- Do not silently rely on `Base.metadata.create_all` outside tests.

### 4.4 Audit Ledger

Files:

- `backend/app/audit_ledger.py`
- `backend/app/models/audit_event.py`
- `backend/tests/test_audit_ledger.py`

Current behavior:

- Audit events are case-local and sequence ordered.
- Each event hash is computed from canonical JSON containing `case_id`, `event_type`, `payload`, and `previous_hash`.
- `AuditEventRepository.append()` is insert-only at the repository API level.
- `list_for_case()` provides ordered readback.

Important limitations:

- There is not yet a dedicated `backend/app/audit/` package with router/logger split.
- Database-level role permission revocation for `UPDATE`/`DELETE` should still be hardened for real Postgres application roles.
- Concurrency safety should be revisited for simultaneous appends to the same case, especially under Postgres.

### 4.5 Deterministic Urgency Scorer and Hard Gate

Files:

- `backend/app/triage/schemas.py`
- `backend/app/triage/urgency_checks.py`
- `backend/app/triage/scorer.py`
- `backend/app/triage/gate.py`
- `backend/tests/test_urgency_gate.py`

Current behavior:

- Rule-based urgency checks exist.
- Cases can be scored into `STANDARD`, `HIGH`, or `CRITICAL`.
- Gate logic exists to block high-risk or low-confidence flows before matching.
- Tests cover the core gate behavior.

Important rule:

- Future matching routes must call the shared gate before retrieving or returning matches. Do not duplicate this policy in route code.

Important limitations:

- Operator release workflow is not yet implemented.
- Gate audit events for release/override decisions are not yet implemented.
- There is not yet a real match endpoint to prove route-level enforcement end to end.

### 4.6 Secure Intake Validation

Files:

- `backend/app/intake/schemas.py`
- `backend/tests/test_intake_schemas.py`

Current behavior:

- Upload input validates filename safety.
- Upload input rejects empty files.
- Upload input enforces max size.
- Upload input sniffs bytes for PDF, PNG, and JPEG signatures.
- Upload input verifies filename extension matches detected content type.
- SHA-256 checksum is computed from raw bytes.
- Content type is derived from bytes, not trusted from the client.

Important details:

- Accepted extensions:
  - PDF: `.pdf`
  - PNG: `.png`
  - JPEG: `.jpg`, `.jpeg`
- A file named `report.pdf` with JPEG bytes is rejected.
- Path traversal and Windows absolute paths are rejected.

### 4.7 Intake Persistence Service

Files:

- `backend/app/intake/service.py`
- `backend/tests/test_intake_service.py`

Current behavior:

- `IntakeService.create_case_with_document()` creates a `CaseRecord`.
- It stores document bytes through an injected `DocumentStorage` abstraction.
- It creates a `Document` with `PENDING` OCR status.
- It appends `CASE_CREATED` and `DOCUMENT_UPLOADED` audit events.

Why implemented this way:

- Storage is injected so tests do not write raw files and production can later use local disk, S3, or another object-store adapter.
- The service takes a SQLAlchemy session so the caller can control transaction boundaries.
- Audit events are written in the same session as the case/document rows.

Important limitations:

- No FastAPI intake router yet.
- No post-commit Celery enqueue yet.
- No duplicate upload policy yet.
- No durable filesystem/object-store implementation yet.

### 4.8 Extraction Foundation

Files:

- `backend/app/extraction/ocr_engine.py`
- `backend/app/extraction/parser_factory.py`
- `backend/app/extraction/schemas.py`
- `backend/app/extraction/parsers/base.py`
- `backend/app/extraction/parsers/income_cert.py`
- `backend/app/extraction/parsers/eviction_notice.py`
- `backend/tests/test_extraction.py`

Current behavior:

- OCR is abstracted behind an `OcrStrategy` protocol.
- `FakeOcrStrategy` exists for deterministic tests.
- `parser_for()` selects parsers for `INCOME_CERTIFICATE` and `EVICTION_NOTICE`.
- Unsupported declared document types are rejected.
- Parsers normalize simple English labels for income certificates and eviction notices.
- Parsers omit malformed, missing, or conflicting duplicate values.
- Field confidence is bounded between `0.0` and `1.0`.

Why implemented this way:

- The parser core is pure and testable without Tesseract, Celery, or database state.
- Real OCR can be added later as a strategy without changing parser tests.

Important limitations:

- Hindi parser labels are not yet safely added. A stopped worktree had mojibake in Hindi tests, so those were deliberately not merged.
- Aadhaar parser is not implemented.
- Real Tesseract/Vision API integration is not implemented.
- Extracted fields are not yet persisted from a Celery task.

### 4.9 Celery/Redis Lifecycle Foundation

Files:

- `backend/app/celery_app.py`
- `backend/app/document_processing.py`
- `backend/tests/test_celery_lifecycle.py`

Current behavior:

- Celery app reads Redis URL from settings.
- Task serializer/result serializer are JSON-only.
- `ProcessingState` models `PENDING`, `PROCESSING`, `DONE`, and `FAILED`.
- Transition helper prevents skipped/backward state transitions.
- Terminal states are idempotent.
- Retryable vs terminal error classification exists.

Important limitations:

- There is no real Celery task yet.
- No task currently reads a document, runs OCR, stores extracted fields, scores urgency, or updates document status.
- No retry policy is attached to actual Celery task decorators yet.

### 4.10 Docker Compose and Container Foundation

Files:

- `docker-compose.yml`
- `docker-compose.prod.yml`
- `.env.example`
- `backend/Dockerfile`
- `infra/Dockerfile.backend`
- `worker/Dockerfile`

Current behavior:

- Compose defines Postgres, Redis, Chroma, backend, worker, and Nginx services.
- Redis URL is wired into backend and worker.
- Chroma host/port env vars are reserved.
- Production override adds restart policies and read-only filesystems for backend/worker.
- Worker and backend use Docker build contexts.

Important limitations:

- `nginx/nginx.conf` does not exist yet.
- Compose Nginx service currently uses stock Nginx behavior and is not routing `/api` to backend yet.
- Full `docker compose up --build` smoke test has not been completed after all changes.
- Container hardening is partial, not final.

## 5. Latest Verification Evidence

Most recent full backend verification after the Phase 2 slices:

```powershell
docker run --rm nyayasetu-backend-test:phase2 python -m pytest -q -p no:cacheprovider
```

Result:

```text
83 passed, 2 warnings in 7.96s
```

Warnings are from FastAPI/Starlette TestClient deprecations, not from NyayaSetu application failures.

Targeted checks also passed:

- `tests/test_intake_schemas.py`: `11 passed`
- `tests/test_intake_service.py`: `1 passed`

Current Git state at the time this document was written:

- Branch: `feat/backend-docker-foundation`
- Working tree before this file: clean
- Subagents were interrupted/stopped per instruction
- No push performed

## 6. What Is Left

### 6.1 Next Immediate Workload

The next best phase is the actual document-processing pipeline:

1. Add `backend/app/extraction/tasks.py`.
2. Implement a Celery task that receives a `document_id`.
3. Load the document row.
4. Transition OCR status from `PENDING` to `PROCESSING`.
5. Read document bytes from a storage abstraction.
6. Run injected OCR strategy.
7. Select parser by `document.document_type`.
8. Persist extracted fields.
9. Append audit events for OCR start, extraction results, and failure cases.
10. Transition document to `COMPLETED` or `FAILED`.
11. Trigger deterministic triage scoring after extraction.

Keep this test-first. The first test should use fake storage and fake OCR, and should prove that a pending document becomes completed with extracted fields and audit events.

### 6.2 Intake Router

Still needed:

- `POST /api/v1/cases`
- `POST /api/v1/cases/{case_id}/documents`
- Multipart upload handling
- Auth/current-user dependency integration
- Transaction boundary
- Post-commit Celery enqueue
- Stable JSON error responses for rejected uploads

Suggested order:

1. Test route rejects disguised files.
2. Test route creates case and document.
3. Test enqueue happens only after DB commit.
4. Implement route.

### 6.3 Real Storage Adapter

Still needed:

- Local durable storage adapter for demo/VM.
- Opaque storage keys.
- No raw local file paths returned to frontend.
- Filename should be metadata only, not path authority.

Suggested file:

- `backend/app/intake/storage.py`

### 6.4 Real OCR Strategy

Still needed:

- Tesseract strategy or Google Vision strategy.
- Tesseract language config for English/Hindi.
- OCR timeout and failure classification.
- Tests using fake strategy only; real OCR should be integration-smoked separately.

Suggested file:

- `backend/app/extraction/ocr_engine.py`

Add real classes without disturbing `FakeOcrStrategy`.

### 6.5 Hindi Parser Labels

Still needed:

- Hindi labels for income certificate and eviction notice.
- Ensure files are UTF-8.
- Add tests with correctly encoded Hindi text.

Important warning:

- A prior stopped agent produced mojibake in Hindi test content. Do not reuse that text blindly.

### 6.6 Knowledge Base Fixtures

Still needed:

- `backend/app/knowledge_base/fixtures/`
- JSON schema for statutory clauses.
- Validation for clause ID, act name, section, clause text, eligibility criteria, jurisdiction, active/version fields.
- Ingestion routine that writes to Postgres and Chroma.

Start with fixtures for:

- Legal Services Authorities Act, 1987
- State victim compensation scheme
- BOCW welfare board rules

### 6.7 Hybrid Matching and Guarded Endpoint

Still needed:

- `backend/app/matching/vector_store.py`
- `backend/app/matching/rule_matcher.py`
- `backend/app/matching/semantic_matcher.py`
- `backend/app/matching/hybrid_matcher.py`
- `backend/app/matching/router.py`

Critical policy:

- The matching endpoint must call the shared triage gate before retrieval.
- Do not query Chroma first and gate later. Gate first.

Tests should prove:

- `HIGH`/`CRITICAL` cases are blocked.
- Standard cases can retrieve matches.
- Empty vector results return safe empty output.
- Every match includes act/section/clause provenance.
- Confidence values are bounded.
- Rule failures discount or reject matches deterministically.

### 6.8 Operator Workflow

Still needed:

- Operator queue.
- Operator release of high-risk cases.
- Field correction.
- Match approval/rejection.
- Referral generation.
- Audit events for every operator decision.

Suggested files:

- `backend/app/operator/router.py`
- `backend/app/operator/service.py`
- `backend/app/operator/schemas.py`
- `backend/app/operator/referral_service.py`

### 6.9 Docker/Nginx/Production Hardening

Still needed:

- Create `nginx/nginx.conf`.
- Route `/api/` to backend.
- Route frontend paths to frontend service once frontend exists.
- Add TLS termination plan for EC2/Let's Encrypt.
- Run `docker compose config`.
- Run full `docker compose up --build` smoke check.
- Confirm backend/worker run non-root.
- Confirm containers do not require write access except `/tmp` and mounted volumes.

### 6.10 CI and Security Checks

Still needed:

- `infra/github-actions/deploy.yml`
- Pytest in CI.
- Alembic migration check in CI.
- Docker build in CI.
- Secret scan / hard-coded secret check.
- Optional dependency vulnerability scan.

## 7. How to Pick Up From Here

Use this sequence:

1. Confirm branch and state:

```powershell
git branch --show-current
git status --short
git log --oneline -5
```

Expected branch:

```text
feat/backend-docker-foundation
```

2. Build backend test image:

```powershell
docker build -q -t nyayasetu-backend-test:local backend
```

3. Run tests:

```powershell
docker run --rm nyayasetu-backend-test:local python -m pytest -q -p no:cacheprovider
```

Expected as of this document:

```text
83 passed, 2 warnings
```

4. Start the next slice with a failing test.

Recommended next test file:

```text
backend/tests/test_extraction_task.py
```

Recommended first behavior:

```text
Pending document with valid bytes, fake OCR text, and supported document type becomes completed, persists extracted fields, and writes audit events.
```

5. Implement the smallest production code to pass.

Recommended next production file:

```text
backend/app/extraction/tasks.py
```

6. Run targeted test, then full suite.

7. Commit locally:

```powershell
git add <changed files>
git commit -m "feat: process documents through extraction task"
```

8. Do not push unless explicitly asked.

## 8. Development Rules to Keep Following

- Use test-first implementation for every risky backend behavior.
- Keep commits small and local.
- Verify before every commit.
- Do not trust agent-generated code without reading diffs and running tests.
- Keep policy decisions server-side.
- Keep OCR, storage, vector store, and external services behind injected adapters.
- Never return raw legal advice; return structured statutory matches with clause provenance.
- Never expose matches for gated cases.
- Every meaningful state change must write an audit event.
- Prefer deterministic rules for eligibility and urgency. Use embeddings only for retrieval, not final legal authority.

## 9. Phase Roadmap From Here

### Phase 2A: Finish Processing Pipeline

Goal: stored document to extracted fields.

Deliverables:

- Real `tasks.py`
- Storage adapter
- Extracted-field persistence
- OCR status transitions
- Failure audit events
- Tests

Estimated remaining effort in this phase: 60 percent.

### Phase 2B: Intake Router

Goal: frontend can create case and upload document.

Deliverables:

- FastAPI routes
- Multipart handling
- Auth/current-user placeholder or real dependency
- Post-commit enqueue
- Route tests

Estimated remaining effort in this phase: 75 percent.

### Phase 3: Knowledge Base and Matching

Goal: deterministic statutory scheme matching.

Deliverables:

- Fixtures
- Fixture validation
- Chroma adapter
- Rule matcher
- Semantic matcher
- Hybrid confidence
- Guarded endpoint

Estimated remaining effort in this phase: 90 percent.

### Phase 4: Operator Console Backend

Goal: paralegal/lawyer can review, release, correct, approve, and refer.

Deliverables:

- Queue endpoint
- Case detail endpoint
- Field correction
- Gate release
- Match decision
- Referral generation
- Audit timeline endpoint

Estimated remaining effort in this phase: 90 percent.

### Phase 5: Docker, CI, and Deployment Hardening

Goal: VM-ready backend stack.

Deliverables:

- Nginx config
- Compose smoke test
- Production override verification
- CI workflow
- Security checks
- Deployment docs

Estimated remaining effort in this phase: 70 percent.

## 10. Current Risk Register

High risk:

- Matching endpoint does not exist yet, so gate enforcement is not proven against a real route.
- Operator release workflow does not exist yet.
- Real OCR task does not exist yet.
- Knowledge-base fixtures are not present yet.

Medium risk:

- Audit immutability is enforced by repository shape and tests, but Postgres role-level restrictions still need hardening.
- Docker Compose foundation exists, but `nginx/nginx.conf` and full compose smoke verification are pending.
- Parser coverage is currently English-focused.

Low risk:

- Core model constraints are covered.
- Upload magic-byte validation is covered.
- Extension/content mismatch rejection is covered.
- Celery Redis config is covered.
- Processing lifecycle transitions are covered.

## 11. Mental Model of the Backend Pipeline

The intended pipeline is:

```text
Citizen upload
  -> secure intake validation
  -> case row + document row
  -> audit: CASE_CREATED / DOCUMENT_UPLOADED
  -> Celery extraction task
  -> OCR strategy
  -> parser factory
  -> extracted fields
  -> audit: OCR / extraction events
  -> urgency scorer
  -> hard gate decision
  -> if STANDARD: matching allowed
  -> if HIGH/CRITICAL: operator review required
  -> statutory matching
  -> operator approval/referral
  -> append-only audit trail throughout
```

Current code reaches the case/document/audit foundation and parser/lifecycle foundation. The actual Celery task, matching layer, and operator workflow are the main missing bridges.

