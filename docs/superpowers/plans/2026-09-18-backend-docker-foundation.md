# NyayaSetu Backend and Docker Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Build a secure, testable FastAPI modular monolith that accepts case documents, extracts evidence asynchronously, gates urgent cases before matching, and records a tamper-evident audit ledger.

**Architecture:** PostgreSQL is the system of record; Redis brokers Celery work; Chroma is retrieval-only. Pipeline transitions are explicit and transactional. The triage gate is the sole policy decision point for exposing matches and is enforced by backend routes and service entry points.

**Tech Stack:** Python 3.11, FastAPI, Pydantic v2, SQLAlchemy 2, Alembic, PostgreSQL 16, Redis, Celery, Tesseract, ChromaDB, Docker Compose.

**Spec:** `C:\Users\riyaj\Downloads\NyayaSetu_System_Design_Report.docx`

## Global Constraints

- Base API path is `/api/v1`; errors use stable JSON `{ "detail": "..." }`.
- Never expose statutory matches for `HIGH` or `CRITICAL` cases until a privileged operator explicitly releases the gate.
- Every pipeline and operator state change writes an append-only, per-case hash-chained audit event.
- Sensitive uploads are validated by extension, MIME sniffing, size, and image decode before storage; raw paths are never returned to clients.
- Stateless API containers; durable data only in Postgres, Chroma, and a mounted document volume/object-store abstraction.
- No LLM-generated legal advice or autonomous referral issuance.
- Tests are written and observed failing before each production behavior is implemented.

---

### Task 1: Bootstrap configuration and health endpoint

**Files:** Create `backend/pyproject.toml`, `backend/app/main.py`, `backend/app/config.py`, `backend/app/deps.py`, `backend/tests/test_health.py`.

- [ ] Write `test_health_reports_service_and_dependencies` asserting `GET /api/v1/health` returns HTTP 200 and `{"status":"ok"}` with test settings.
- [ ] Run `pytest backend/tests/test_health.py -v`; confirm it fails because the app/route is missing.
- [ ] Implement Pydantic settings (environment-only secrets), app factory, CORS allow-list, request-size limit, and the health route.
- [ ] Re-run the targeted test; confirm it passes.

### Task 2: Database schema and migration

**Files:** Create `backend/app/db.py`, `backend/app/models/{base,user,case,document,extracted_field,scheme_clause,scheme_match,audit_event}.py`, `backend/alembic/env.py`, `backend/alembic/versions/0001_initial_schema.py`, `backend/tests/test_models.py`.

- [ ] Write tests that reject invalid role/status/tier values and assert required case-document and case-audit foreign keys.
- [ ] Run the targeted tests and confirm the missing-model failure.
- [ ] Implement UUID models, UTC timestamps, constrained enums, indexes from the design report, and migration DDL including `pgcrypto`.
- [ ] Run model tests plus `alembic upgrade head` against the test database.

### Task 3: Append-only hash-chained audit ledger

**Files:** Create `backend/app/audit/{hash_chain,repository,logger,router}.py`, `backend/tests/test_audit_immutability.py`.

- [ ] Write tests for deterministic hashes, case-local previous-hash linking, read-only retrieval, and database rejection of `UPDATE`/`DELETE` for the application role.
- [ ] Run the tests and confirm they fail before the ledger exists.
- [ ] Implement canonical JSON hashing, transactional previous-event lookup with row locking, insert-only repository methods, and migration SQL that revokes updates/deletes.
- [ ] Re-run targeted tests and the migration permission test.

### Task 4: Secure intake and document persistence

**Files:** Create `backend/app/intake/{schemas,service,router,storage}.py`, `backend/tests/test_intake.py`.

- [ ] Write tests for valid JPEG/PNG/PDF upload, duplicate/unknown case rejection, oversized/corrupt/disguised file rejection, generated opaque storage key, and `CASE_CREATED`/`DOCUMENT_UPLOADED` audit events.
- [ ] Run tests; confirm missing-route failures.
- [ ] Implement `POST /cases` and `POST /cases/{id}/documents`, MIME + magic-byte validation, SHA-256 file checksum, safe filename handling, atomic persistence, and a Celery enqueue only after commit.
- [ ] Re-run intake tests using a temporary storage adapter.

### Task 5: Async extraction and parsing

**Files:** Create `backend/app/celery_app.py`, `backend/app/extraction/{tasks,ocr_engine,parser_factory,schemas}.py`, `backend/app/extraction/parsers/{base,income_cert,eviction_notice,aadhaar}.py`, `backend/tests/test_extraction.py`.

- [ ] Write tests for pending→processing→done/failed transitions, Hindi+English OCR strategy selection, confidence bounds, parser selection, invalid declared document type, and failed OCR audit records.
- [ ] Run tests and confirm missing-task/strategy failures.
- [ ] Implement injected OCR strategies, bounded regex parsers, Pydantic-normalised fields, idempotent task handling, retryable versus terminal errors, and audit events.
- [ ] Re-run extraction tests without invoking a real OCR binary.

### Task 6: Deterministic urgency scoring and hard gate

**Files:** Create `backend/app/triage/{schemas,urgency_checks,scorer,gate}.py`, `backend/tests/test_urgency_gate.py`.

- [ ] Write tests for violence, detention, eviction-under-seven-days, dependent-risk, repeated escalation, tier boundaries (0/20/40), deduplicated triggers, and malicious/missing extraction data.
- [ ] Write route/service tests proving `HIGH` and `CRITICAL` cases cannot call matching or receive results, even by direct API request; test operator release requires privileged role, reason, and audit event.
- [ ] Run tests; confirm missing implementation failures.
- [ ] Implement immutable `TriageResult`, ordered checks, deterministic score aggregation, explicit `GateDecision`, and one shared `require_match_access` dependency used by every match-exposure path.
- [ ] Re-run all triage tests; inspect that tests exercise real scorer/gate code rather than frontend assumptions.

### Task 7: Guarded hybrid statutory matching

**Files:** Create `backend/app/matching/{schemas,vector_store,semantic_matcher,rule_matcher,hybrid_matcher,router}.py`, `backend/app/knowledge_base/{ingest,router,fixtures/legal_services_authorities_act_1987.json}.py`, `backend/tests/test_hybrid_matcher.py`.

- [ ] Write tests for clause-level provenance, criterion pass/fail/unknown values, bounded confidence, threshold filtering, inactive/versioned clause exclusion, empty vector results, and gate-before-matcher invocation.
- [ ] Run tests and confirm expected failures.
- [ ] Implement a Chroma adapter interface, fixture ingestion, normalised case summary, semantic retrieval, safe JSON eligibility evaluators, confidence discounting for rule failures, and operator-only match endpoint.
- [ ] Re-run matcher tests using a deterministic fake vector adapter.

### Task 8: Operator release and case lifecycle

**Files:** Create `backend/app/operator/{schemas,service,router,referral_service}.py`, `backend/tests/test_operator_workflow.py`.

- [ ] Write tests for queue ordering, field correction provenance, operator role denial, release/approve/override/reject transitions, idempotent decisions, rejected referral drafts, and all corresponding audit events.
- [ ] Run tests; confirm missing endpoint failures.
- [ ] Implement privileged endpoints, optimistic status checks, field-correction history, gate-release validation, referral-draft generation, and atomic audit writes.
- [ ] Re-run operator workflow tests.

### Task 9: Containerised local and production configuration

**Files:** Create `docker-compose.yml`, `docker-compose.prod.yml`, `.env.example`, `infra/Dockerfile.backend`, `worker/Dockerfile`, `backend/Dockerfile`, `.dockerignore`.

- [ ] Write a compose smoke test/script that asserts all declared services have health checks and no secret has a hard-coded value.
- [ ] Run it and confirm configuration is initially absent.
- [ ] Implement backend, worker, Postgres, Redis, Chroma, frontend placeholder/network contract, and Nginx service definitions; use non-root images, named volumes, health-gated dependencies, restart policies, and environment substitution.
- [ ] Run `docker compose config` and a health-checked `docker compose up --build`; capture container status and logs.

### Task 10: Full verification and handoff

**Files:** Modify `README.md` only if present; create `docs/backend-api-contract.md`.

- [ ] Run complete backend test suite, Alembic migration round-trip, static Python compilation, `docker compose config`, and container smoke tests.
- [ ] Verify no source file embeds a secret, no audit mutation path exists, all match routes use the shared gate, and Git has no unintended/generated files.
- [ ] Document the API contracts required by the citizen and operator frontends, including blocked-case responses and status values.
- [ ] Do not push. Report exact verification evidence and local branch status.
