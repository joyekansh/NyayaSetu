# NyayaSetu

**Evidence-backed legal aid triage and referral for India's statutory entitlement programs.**

NyayaSetu is not a legal-advice chatbot. It is an automated intake, triage, and referral pipeline that converts a citizen's documents *and* spoken complaint into a structured, statute-grounded case dossier — routing the most vulnerable cases straight to a human and never to AI-generated advice — then hands the case directly into the real government legal-aid system (NALSA/LSAMS) with a verifiable official reference number, under a permanent audit trail.

---

## Table of Contents

- [Problem Statement](#problem-statement)
- [The Solution](#the-solution)
- [Core Differentiators](#core-differentiators)
- [Who Uses It](#who-uses-it)
- [Tech Stack](#tech-stack)
- [Architecture & Data Flow](#architecture--data-flow)
- [Project Structure](#project-structure)
- [Team & Ownership](#team--ownership)
- [Documentation](#documentation)
- [Known Limitations (Hackathon Scope)](#known-limitations-hackathon-scope)

---

## Problem Statement

Low-income and marginalized citizens in India are legally entitled to free legal aid, victim compensation, and welfare schemes — but structurally cannot access them:

- **Fragmented physical documentation** citizens must gather and correctly present, with no help interpreting what's actually needed for their situation.
- **Opaque eligibility criteria** buried in dense, siloed statutory language across multiple state-specific schemes.
- **A broken supply-demand match**: roughly 1 lawyer per 10,000 rural people, and very low public awareness of what's even available.

Existing government portals are passive, unindexed directories. Generic AI chatbots fill part of the gap but introduce a worse problem: they can hallucinate legal advice with no statutory grounding and no accountability — unacceptable in a context where a wrong answer can cost someone their case, their safety, or their entitlement window.

## The Solution

NyayaSetu sits in front of India's existing legal-aid infrastructure (NALSA, SLSAs, DLSAs) on one non-negotiable principle: **AI prepares evidence, a human always decides — enforced structurally, not as a policy promise.**

- **Converts raw input into structured, verified case data** — documents via OCR/entity extraction, and/or a spoken complaint (Hindi or English) transcribed via ElevenLabs Speech-to-Text and parsed for threat language, temporal markers, and vulnerability signals.
- **Applies a two-layer, deterministic risk model** — Layer 1 hard triggers (unsafe answer to a mandatory safety question, self-harm/imminent-threat language, minor-abuse disclosure, sub-24h deadline) force Critical regardless of anything else; Layer 2 is a weighted composite score for everything else. Extraction/transcription uncertainty can only push risk *up*, never down.
- **Routes by risk, not convenience** — Standard-tier cases get an AI-generated Case Dossier with exact statutory citations and confidence scores, explicitly labeled "not legal advice." High/Critical cases (including DV cases, routed to a Protection Officer) get no AI-generated content at all — only a human-reviewed outcome ever reaches the citizen.
- **Matches against a curated, versioned statutory knowledge base** via hybrid semantic + rule-based retrieval, so every recommendation carries an exact Act, section number, clause text, and confidence score.
- **Hands off into the real government system** — auto-fills NALSA's actual LSAMS application on operator sign-off, returning a real, independently-trackable Diary/Registration Number.
- **Leaves a permanent, tamper-evident record** — every OCR parse, transcript, risk decision, match, and human override is written to an append-only, hash-chained audit ledger.

## Core Differentiators

| Differentiator | What it means in practice |
|---|---|
| **Evidence-backed case dossier, not a chatbot** | No free-text generative advice is ever shown to a citizen. Every output is structured data mapped to a statutory clause. |
| **Deterministic statutory grounding** | Every recommended scheme displays the exact Act, section number, clause text, and confidence score. |
| **Two-layer human-in-the-loop hard gate** | Hard triggers (safety check, self-harm language, minor-abuse disclosure, imminent deadlines) force Critical and skip all AI matching; a weighted composite score handles everything else. Enforced at the API layer, not the UI. |
| **Real government integration** | Referrals are submitted into NALSA's actual LSAMS system, producing a real Diary/Registration Number trackable independently on the official NALSA portal. |
| **Tamper-proof audit trail** | Every automated and human action is written to an append-only, hash-chained ledger — no `UPDATE`/`DELETE` permissions exist on it. |

## Who Uses It

| User Type | Role |
|---|---|
| **Citizen** | Uploads documents and/or speaks their complaint; receives a dossier (Standard tier) or a status update only (High/Critical tier). |
| **PLV (Para Legal Volunteer) / Kiosk Operator** | Assists citizens with low digital literacy via Assisted Mode; handles Standard-tier case review. |
| **Panel Lawyer** | Reviews High/Critical tier cases; approves/overrides scheme matches; issues referrals. |
| **Protection Officer** | Coordinated with specifically for domestic-violence-flagged Critical cases. |
| **DLSA Admin** | Manages office workload and the versioned statutory knowledge base. |

---

## Tech Stack

**Frontend:** Next.js (React) + TypeScript, Tailwind CSS, shadcn/ui, i18next (Hindi/English)

**Backend:** FastAPI (Python), Pydantic v2, Celery + Redis for async OCR/STT/extraction tasks

**Speech & OCR:** ElevenLabs Speech-to-Text, Tesseract OCR / Google Cloud Vision, regex/heuristic layout parsers

**Knowledge Retrieval:** ChromaDB, LangChain, multilingual sentence embeddings, hybrid semantic + rule-based matching

**Data & Audit:** PostgreSQL, append-only hash-chained audit ledger

**External Integration:** NALSA LSAMS (mocked for hackathon build — see Known Limitations)

**Infra:** Docker & Docker Compose, Nginx + Let's Encrypt, single Linux VM

Full rationale for every choice is in [`docs/NyayaSetu_System_Design_Report_v2.md`](docs/NyayaSetu_System_Design_Report_v2.md).

---

## Architecture & Data Flow

Modular monolith (FastAPI) — cleanly separated into `intake/`, `speech/`, `extraction/`, `triage/`, `matching/`, `operator/`, `referral/`, `audit/`, and `knowledge_base/` modules, each a future microservice boundary.

```
Citizen: Document Upload  +  Spoken Complaint (ElevenLabs STT)
                  ↓
        Intake API → Postgres (case created)
                  ↓
   OCR / Transcript Extraction → Pydantic validation
                  ↓
        Safety Question Check (immediate short-circuit)
                  ↓
   ┌─────────── Layer 1: Hard Triggers ───────────┐
   │  fires → CRITICAL (skip everything below)    │
   └───────────────────┬───────────────────────────┘
                        ↓ (no trigger fired)
             Layer 2: Weighted Composite Score
                        ↓
              ┌─────────┴─────────┐
        CRITICAL / HIGH        STANDARD
              ↓                     ↓
        HARD GATE           Semantic + Rule Matcher
     (human queue only,     (versioned statutory KB)
      + Protection Officer         ↓
       if DV-flagged)      Case Dossier Draft
              ↓                     ↓
           Operator Console (PLV / Panel Lawyer)
                        ↓
         Approve / Override → Issue Referral
                        ↓
        LSAMS Auto-fill → Diary/Registration Number
                        ↓
     Citizen: NyayaSetu status + NALSA portal tracking

Every step above → Append-only, hash-chained Audit Ledger
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
│       ├── speech/            # ElevenLabs STT integration
│       ├── extraction/
│       ├── triage/            # includes the hard-trigger chain + risk gate
│       ├── matching/
│       ├── operator/
│       ├── referral/          # LSAMS client (mocked for hackathon)
│       ├── audit/             # append-only ledger
│       └── knowledge_base/
├── worker/            # Celery worker Dockerfile
├── nginx/             # reverse proxy config
├── infra/             # Dockerfiles, CI/CD
└── docs/              # design report, file structure, demo script
```

See [`docs/NyayaSetu_File_Structure_and_Data_Flow.md`](docs/NyayaSetu_File_Structure_and_Data_Flow.md) for the complete file-by-file breakdown and reasoning.

---

## Team & Ownership

| Member | Owns |
|---|---|
| **Riya** | Backend core (`intake/`, `speech/`, `extraction/`, `triage/` incl. the hard gate, `models/`), Docker & Docker Compose, DB migrations |
| **Akash** | Citizen-facing frontend, design system (Tailwind tokens, shadcn styling, locales), `documentApi.ts` |
| **Joy** | Operator-facing frontend, `MatchCard.tsx`, `AuditTimeline.tsx`, `apiClient.ts`, `caseApi.ts` |
| **Divyansh** | Deployment (Nginx, CI/CD, EC2), testing (risk-gate and audit-immutability tests, Playwright E2E), demo rehearsal |

Full role breakdown, technical objectives, and integration points are in [`docs/`](docs/).

---

## Documentation

- [`docs/NyayaSetu_System_Design_Report_v2.md`](docs/NyayaSetu_System_Design_Report_v2.md) — Requirements, HLD, LLD, infra/security, 36-hour feasibility check
- [`docs/NyayaSetu_File_Structure_and_Data_Flow.md`](docs/NyayaSetu_File_Structure_and_Data_Flow.md) — Full repo structure with reasoning, and a traced file-to-file request flow
- [`docs/demo_script.md`](docs/demo_script.md) — The judge walkthrough

---

## Known Limitations (Hackathon Scope)

This build intentionally cuts scope to prioritize the demonstrable core differentiators. Explicitly **not** implemented as real, live integrations in the hackathon build:

- **NALSA LSAMS submission** — the full internal flow (payload construction, audit logging, locked-case UX) is built, but points at a **mocked** endpoint. Real integration requires an NALSA/DLSA partnership and is a production dependency outside this team's control.
- **NALSA portal tracking** — surfaced as a deep-link using the mocked Diary Number; no live polling/scraping of the real portal.
- Kubernetes / multi-region deployment
- Full DPDP Act 2023 compliance implementation (consent flows are UI-only)
- LayoutLM-based document parsing (regex/heuristic parsers used instead)
- Production-grade OAuth2 provider integration
- TLS with a fully provisioned domain (unless pre-arranged before build start)
- High-accuracy Hindi OCR/STT (operator correction and full-transcript review are the actual reliability mechanisms, not raw model precision)

See §5 of the [system design report](docs/NyayaSetu_System_Design_Report_v2.md) for the full feasibility reasoning.

---

## License

TBD.
