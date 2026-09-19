/**
 * types/api.ts — the contract between this client and backend/app/schemas.py
 *
 * OWNER: Akash. This file is the single seam where frontend and backend agree.
 * Rule for the hackathon: if Riya changes a Pydantic model, this file changes in
 * the SAME commit. Never patch around a mismatch inside a component.
 *
 * Every enum below is a literal union, not a TS `enum`, so the values are exactly
 * the strings Postgres CHECK constraints allow (see section 3.1 of the design report).
 */

/* ------------------------------------------------------------------ */
/* Enums — must match the DB CHECK constraints verbatim                */
/* ------------------------------------------------------------------ */

export type UserRole = 'citizen' | 'paralegal' | 'panel_lawyer' | 'dlsa_admin';

export type CaseStatus =
  | 'RECEIVED'
  | 'EXTRACTED'
  | 'TRIAGED'
  | 'MATCHED'
  | 'IN_REVIEW'
  | 'REFERRED'
  | 'CLOSED';

export type UrgencyTier = 'STANDARD' | 'HIGH' | 'CRITICAL';

export type OcrStatus = 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';

export type DocType =
  | 'aadhaar'
  | 'income_cert'
  | 'fir'
  | 'eviction_notice'
  | 'wage_slip'
  | 'medical_report'
  | 'speech_recording';

export type OperatorDecision = 'pending' | 'approved' | 'overridden' | 'rejected';

export type AuditEventType =
  | 'OCR_PARSE'
  | 'FIELD_EXTRACTED'
  | 'FIELD_CORRECTED'
  | 'URGENCY_SCORED'
  | 'GATE_ENFORCED'
  | 'MATCH_GENERATED'
  | 'OPERATOR_DECISION'
  | 'REFERRAL_ISSUED';

export type ActorType = 'SYSTEM' | 'OPERATOR';

export type Language = 'hi' | 'en';

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

export interface OtpRequestBody {
  phone: string;
}

export interface OtpVerifyBody {
  phone: string;
  otp: string;
}

export interface OperatorLoginBody {
  email: string;
  password: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: 'bearer';
  expires_in: number;
  user: CurrentUser;
}

export interface CurrentUser {
  id: string;
  role: UserRole;
  full_name: string | null;
  district: string | null;
  phone?: string | null;
  email?: string | null;
}

/* ------------------------------------------------------------------ */
/* Cases                                                               */
/* ------------------------------------------------------------------ */

export interface CreateCaseBody {
  district: string;
  language: Language;
  /** Short structured intake answers (FR-4). Keys mirror the questionnaire IDs. */
  intake_answers: Record<string, string | number | boolean>;
  /** DPDP Act 2023 consent — backend rejects the case without it. */
  consent_given: boolean;
}

export interface CaseSummary {
  id: string;
  status: CaseStatus;
  urgency_tier: UrgencyTier | null;
  urgency_score: number | null;
  district: string | null;
  language: Language;
  created_at: string;
  updated_at: string;
}

/**
 * GET /cases/{id}
 *
 * IMPORTANT: `matches` is null whenever the hard gate is engaged — that is, for a
 * CRITICAL/HIGH case viewed by a citizen. It is not an empty array and it is not a
 * loading state. The gate lives in backend/app/triage/gate.py; this client must
 * render the gated notice, never try to fetch matches by another route.
 */
export interface CaseDetail extends CaseSummary {
  citizen_id: string | null;
  created_by_operator_id: string | null;
  documents: DocumentRecord[];
  matches: SchemeMatch[] | null;
  gated: boolean;
  /** Human-readable reason shown to the citizen when `gated` is true. */
  gate_notice: string | null;
  triage_signals: TriageSignal[] | null;
}

export interface TriageSignal {
  check_name: string;
  triggered: boolean;
  weight: number;
  evidence: string | null;
}

/* ------------------------------------------------------------------ */
/* Documents & extraction                                              */
/* ------------------------------------------------------------------ */

export interface DocumentRecord {
  id: string;
  case_id: string;
  doc_type: DocType | null;
  ocr_status: OcrStatus;
  ocr_engine: string | null;
  ocr_confidence: number | null;
  uploaded_at: string;
  /** Signed URL for the operator's side-by-side image view (FR-12). */
  preview_url: string | null;
  extracted_fields: ExtractedField[];
}

export interface ExtractedField {
  id: string;
  document_id: string;
  field_name: string;
  field_value: string | null;
  confidence: number | null;
  is_operator_corrected: boolean;
  corrected_by_operator_id: string | null;
}

/** GET /cases/{case_id}/documents/{doc_id}/status — the poll response. */
export interface DocumentStatus {
  document_id: string;
  ocr_status: OcrStatus;
  ocr_confidence: number | null;
  error_message: string | null;
  extracted_fields: ExtractedField[];
}

export interface FieldCorrectionBody {
  field_id: string;
  field_value: string;
}

/* ------------------------------------------------------------------ */
/* Matching                                                            */
/* ------------------------------------------------------------------ */

export interface SchemeMatch {
  id: string;
  case_id: string;
  scheme_name: string;
  act_name: string | null;
  section_number: string | null;
  /** Verbatim statutory text. Render as a quote — never paraphrase in the UI. */
  clause_text: string;
  semantic_score: number;
  rule_eligibility_pass: boolean;
  final_confidence: number;
  operator_decision: OperatorDecision;
  decision_reason: string | null;
  decided_at: string | null;
}

export interface MatchDecisionBody {
  decision: Exclude<OperatorDecision, 'pending'>;
  /** Mandatory per FR-13 — backend 422s on an empty reason. */
  reason: string;
  confidence_at_decision: number;
}

/* ------------------------------------------------------------------ */
/* Operator queue, referral, audit                                     */
/* ------------------------------------------------------------------ */

export interface QueueItem {
  case_id: string;
  urgency_tier: UrgencyTier;
  urgency_score: number;
  status: CaseStatus;
  district: string | null;
  document_count: number;
  created_at: string;
  /** Seconds left against the tier's SLA. Negative means breached. */
  sla_seconds_remaining: number;
}

export interface QueueFilters {
  tier?: UrgencyTier;
  status?: CaseStatus;
  limit?: number;
  offset?: number;
}

export interface ReferralBody {
  referred_to: string;
  notes: string;
}

export interface ReferralReceipt {
  referral_id: string;
  case_id: string;
  referred_to: string;
  document_url: string;
  /** sha256 of the generated PDF — the tamper-evidence claim in FR-19. */
  document_hash: string;
  issued_at: string;
}

export interface AuditEvent {
  id: number;
  case_id: string;
  event_type: AuditEventType;
  actor_type: ActorType;
  actor_id: string | null;
  payload: Record<string, unknown>;
  event_hash: string;
  previous_hash: string | null;
  created_at: string;
}

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

/** FastAPI's default error envelope. */
export interface ApiErrorBody {
  detail: string | { msg: string; loc: (string | number)[] }[];
}
