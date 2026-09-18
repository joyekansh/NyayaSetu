# NyayaSetu API Contract

This document outlines the core API surface for the NyayaSetu legal aid triage backend.

## Base URL
`/api/v1`

## Authentication
Authentication is now handled via JWT (JSON Web Tokens).

### `POST /auth/login`
Authenticate a user and retrieve a JWT.
**Request (Form Data):**
- `username`: The user's display name (e.g. `Worker`).
- `password`: The user's password (currently bypassed for demo purposes).
**Response:**
```json
{
  "access_token": "eyJhbGciOi...",
  "token_type": "bearer"
}
```

> [!IMPORTANT]
> All authenticated endpoints require the `Authorization: Bearer <token>` header instead of the legacy `X-User-Id` header.

## Operator Workflows

### `GET /operator/queue`
Retrieve the queue of triaged cases requiring human operator review.
**Requires:** `Authorization: Bearer <token>` (User must be `caseworker` or `admin`).

### `POST /operator/cases/{case_id}/release`
Release a case from the queue into active review.

### `POST /operator/cases/{case_id}/matches/{clause_id}/approve`
Approve a semantically matched legal scheme clause for a specific case.

### `POST /operator/cases/{case_id}/matches/{clause_id}/reject`
Reject a semantically matched legal scheme clause.

### `POST /operator/cases/{case_id}/referral`
Generate a referral for the client based on the approved schemes, concluding the triage process.
**Request (JSON):**
```json
{
  "summary": "Client is eligible for NALSA free legal aid due to sudden income loss.",
  "referred_schemes": "NALSA Section 12(e)"
}
```

## Intake and Uploads

### `POST /cases`
Create a new case (requires user consent).

### `POST /cases/{case_id}/documents`
Upload a document image or PDF for OCR extraction. Trigger background Celery processing for text extraction and semantic urgency scoring.
