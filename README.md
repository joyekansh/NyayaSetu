# NyayaSetu

**Evidence-backed legal aid triage for India's statutory entitlement programs.**

NyayaSetu is not a legal-advice chatbot. It is an automated intake and triage pipeline that converts raw, multilingual physical documents (Aadhaar, income certificates, FIRs, eviction notices, etc.) into a structured, statute-grounded case dossier for legal-aid cells and paralegals — with every recommendation traceable to an exact legislative clause, and every high-risk case gated to mandatory human review before any output is returned.

---

## Table of Contents

- [Core Differentiators](#core-differentiators)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Running the Project](#running-the-project)
- [Testing](#testing)
- [Team & Ownership](#team--ownership)
- [Documentation](#documentation)
- [Known Limitations (Hackathon Scope)](#known-limitations-hackathon-scope)

---

## Core Differentiators

| Differentiator | What it means in practice |
|---|---|
| **Evidence-backed case dossier, not a chatbot** | No free-text generative advice is ever shown to a citizen. Every output is structured data mapped to a statutory clause. |
| **Deterministic statutory grounding** | Every recommended scheme displays the exact Act, section number, clause text, and a confidence score — sourced from a curated, versioned knowledge base. |
| **Human-in-the-loop hard gate** | Cases flagged Critical/High urgency (domestic abuse, imminent eviction, arbitrary detention) are architecturally blocked from returning any automated match — enforced at the API layer, not just the UI — until an accredited operator reviews the case. |
| **Tamper-proof audit trail** | Every OCR parse, semantic match, tier assignment, and human decision is written to an append-only, hash-chained ledger. No `UPDATE`/`DELETE` permissions exist on this table at the database role level. |

---

## Tech Stack

**Frontend:** Next.js (React 18/19) + TypeScript, Tailwind CSS, shadcn/ui, Lucide Icons, i18next (Hindi/English)

**Backend:** FastAPI (Python 3.11+), Pydantic v2, Celery + Redis for async OCR/extraction tasks

**OCR & Extraction:** Tesseract OCR (Hindi + English) or Google Cloud Vision API, regex/heuristic layout parsers

**Knowledge Retrieval:** ChromaDB, LangChain, `paraphrase-multilingual-MiniLM-L12-v2` embeddings, hybrid semantic + rule-based matching

**Data & Audit:** PostgreSQL 16, append-only audit ledger with SHA-256 hash chaining

**Testing:** PyTest, Ragas (retrieval faithfulness), Playwright (E2E)

**Infra:** Docker & Docker Compose, Nginx + Let's Encrypt, single Linux VM (AWS EC2 t3.large or equivalent)

Full rationale for every choice is in [`docs/NyayaSetu_System_Design_Report.md`](docs/NyayaSetu_System_Design_Report.md).

---

## Architecture

Modular monolith (FastAPI) — one deployable unit, cleanly separated into `intake/`, `extraction/`, `triage/`, `matching/`, `operator/`, `audit/`, and `knowledge_base/` modules, each a future microservice boundary.

```
Citizen/Kiosk Upload
      ↓
Intake API → Postgres (case created)
      ↓
Celery Task → OCR Worker → Field Parser → Pydantic validation
      ↓
Urgency Scorer (deterministic weighted matrix)
      ↓
   ┌──────────────┴──────────────┐
CRITICAL/HIGH                 STANDARD
   ↓                              ↓
HARD GATE                 Semantic + Rule Matcher
(human queue only)         (statutory KB, ChromaDB)
   ↓                              ↓
Operator Console ←───────── Case Dossier Draft
   ↓
Approve / Override / Refer
   ↓
Every step → Append-only Audit Ledger (hash-chained)
```

Full data flow, including the exact file each request passes through, is in [`docs/NyayaSetu_File_Structure_and_Data_Flow.md`](docs/NyayaSetu_File_Structure_and_Data_Flow.md).

---

## Project Structure

```
nyayasetu/
├── frontend/          # Next.js citizen + operator client
├── backend/           # FastAPI modular monolith
│   └── app/
│       ├── auth/
│       ├── intake/
│       ├── extraction/
│       ├── triage/          # includes gate.py — the hard human-in-the-loop gate
│       ├── matching/
│       ├── operator/
│       ├── audit/           # append-only ledger
│       └── knowledge_base/
├── worker/            # Celery worker Dockerfile
├── nginx/             # reverse proxy config
├── infra/             # Dockerfiles, CI/CD
└── docs/              # design report, file structure, demo script
```

See [`docs/NyayaSetu_File_Structure_and_Data_Flow.md`](docs/NyayaSetu_File_Structure_and_Data_Flow.md) for the complete file-by-file breakdown and reasoning.

---

## Getting Started

### Prerequisites

```bash
git
Docker Desktop (or Docker Engine + Docker Compose v2)
Node.js 20 LTS + npm
Python 3.11+
```

### Clone & Install

```bash
git clone <repo-url> nyayasetu
cd nyayasetu
cp .env.example .env        # fill in secrets — see Environment Variables below

# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Frontend
cd ../frontend
npm install
```

---

## Environment Variables

Copy `.env.example` to `.env` and set:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/nyayasetu

# Redis / Celery
REDIS_URL=redis://localhost:6379/0

# Auth
JWT_SECRET=change-me
JWT_EXPIRY_MINUTES=30

# OCR
OCR_ENGINE=tesseract          # or "vision_api"
GOOGLE_VISION_API_KEY=        # only if OCR_ENGINE=vision_api

# Vector store
CHROMA_PERSIST_DIR=./data/chroma

# Frontend
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
```

Never commit `.env`. Only `.env.example` (with placeholder values) is tracked in git.

---

## Running the Project

### Full stack via Docker Compose (recommended)

```bash
docker compose up --build
```

This starts: `frontend`, `backend`, `worker` (Celery), `redis`, `postgres`, `chromadb`, `nginx`.

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000/api/v1`
- API docs (FastAPI auto-generated): `http://localhost:8000/docs`

### Running services individually (for active development)

```bash
# Backend
cd backend
uvicorn app.main:app --reload --port 8000

# Celery worker
cd backend
celery -A app.celery_app worker --loglevel=info

# Frontend
cd frontend
npm run dev
```

### Seeding the statutory knowledge base

```bash
cd backend
python -m app.knowledge_base.ingest
```
Loads the curated JSON fixtures (NALSA Act 1987, State Victim Compensation Scheme, BOCW Welfare Board rules) from `backend/app/knowledge_base/fixtures/`, chunks them at clause level, and embeds them into ChromaDB.

### Running database migrations

```bash
cd backend
alembic upgrade head
```

---

## Testing

```bash
# Backend unit tests
cd backend
pytest

# Specifically the two risk-critical tests:
pytest tests/test_urgency_gate.py         # asserts gated cases can't reach /matches
pytest tests/test_audit_immutability.py   # asserts UPDATE/DELETE on audit_events fails

# Retrieval faithfulness (Ragas)
pytest tests/test_hybrid_matcher.py

# E2E (Playwright)
cd frontend
npx playwright install     # first time only
npx playwright test
```

---

## Team & Ownership

| Member | Owns |
|---|---|
| **Riya** | Backend core (`intake/`, `extraction/`, `triage/` incl. `gate.py`, `models/`), Docker & Docker Compose, DB migrations |
| **Akash** | Citizen-facing frontend (`(citizen)/`), design system (Tailwind tokens, shadcn styling, locales), `documentApi.ts` |
| **Joy** | Operator-facing frontend (`(operator)/`), `MatchCard.tsx`, `AuditTimeline.tsx`, `apiClient.ts`, `caseApi.ts` |
| **Divyansh** | Deployment (Nginx, CI/CD, EC2), testing (`test_urgency_gate.py`, `test_audit_immutability.py`, Playwright E2E), demo rehearsal |

Full role breakdown, technical objectives, and integration points are in [`docs/`](docs/).

---

## Documentation

- [`docs/NyayaSetu_System_Design_Report.md`](docs/NyayaSetu_System_Design_Report.md) — Requirements, HLD, LLD, infra/security, 36-hour feasibility check
- [`docs/NyayaSetu_File_Structure_and_Data_Flow.md`](docs/NyayaSetu_File_Structure_and_Data_Flow.md) — Full repo structure with reasoning, and a traced file-to-file request flow
- [`docs/demo_script.md`](docs/demo_script.md) — The 5-step judge walkthrough

---

## Known Limitations (Hackathon Scope)

This build intentionally cuts scope to prioritize the demonstrable core differentiators. Explicitly **not** implemented in the hackathon build:

- Kubernetes / multi-region deployment
- Full DPDP Act 2023 compliance implementation (consent flows are UI-only, not a full data-rights pipeline)
- LayoutLM-based document parsing (regex/heuristic parsers used instead)
- Production-grade OAuth2 provider integration
- TLS with a fully provisioned domain (unless pre-arranged before build start)
- High-accuracy Hindi OCR (operator correction UI is the actual reliability mechanism, not raw OCR precision)

See §5 of the [system design report](docs/NyayaSetu_System_Design_Report.md) for the full feasibility reasoning.

---

## License

TBD.
