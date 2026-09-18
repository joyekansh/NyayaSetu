/**
 * types/api.ts
 *
 * TS interfaces mirroring backend Pydantic schemas. Kept in sync manually
 * with Riya's backend response models.
 *
 * SHARED FILE with Akash (citizen-side types live here too). Operator-side
 * additions are grouped and commented below — if you're adding a new
 * response shape for an operator endpoint, add it in the OPERATOR section
 * and ping Akash + Riya so nobody's parallel edit gets clobbered.
 */

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export type UrgencyTier = "CRITICAL" | "HIGH" | "STANDARD";

export type OperatorRole = "PARALEGAL" | "PANEL_LAWYER" | "DLSA_ADMIN";

export type CaseStatus =
  | "INTAKE"
  | "EXTRACTING"
  | "TRIAGED"
  | "IN_REVIEW"
  | "REFERRED"
  | "CLOSED";

export type MatchDecisionAction = "APPROVE" | "OVERRIDE" | "REJECT";

// ---------------------------------------------------------------------------
// OPERATOR: auth
// ---------------------------------------------------------------------------

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  role: OperatorRole;
  display_name: string;
}

// ---------------------------------------------------------------------------
// OPERATOR: queue (F1, F2)
// ---------------------------------------------------------------------------

export interface QueueItem {
  case_id: string;
  citizen_display_name: string;
  urgency_tier: UrgencyTier;
  status: CaseStatus;
  sla_deadline: string; // ISO 8601 — page computes the countdown client-side
  created_at: string; // ISO 8601
  is_gated: boolean; // true when Critical/High and not yet reclassified — drives F8
}

export interface QueueResponse {
  items: QueueItem[];
}

// ---------------------------------------------------------------------------
// OPERATOR: case detail (F3, F4)
// ---------------------------------------------------------------------------

export interface ExtractedField {
  field_name: string;
  value: string;
  confidence: number; // 0..1
  is_low_confidence: boolean;
}

export interface CaseDetail {
  case_id: string;
  citizen_display_name: string;
  urgency_tier: UrgencyTier;
  status: CaseStatus;
  is_gated: boolean;
  document_image_url: string;
  extracted_fields: ExtractedField[];
  created_at: string;
  locked: boolean; // true once a referral has been issued (F6)
}

// ---------------------------------------------------------------------------
// OPERATOR: scheme matches (F4, F5)
// ---------------------------------------------------------------------------

export interface SchemeMatch {
  match_id: string;
  scheme_name: string;
  act_name: string;
  section_number: string;
  clause_text: string; // verbatim — never a generated summary
  semantic_score: number;
  rule_score: number;
  final_confidence: number;
  operator_decision: MatchDecisionAction | null;
  decision_reason: string | null;
}

export interface MatchesResponse {
  case_id: string;
  matches: SchemeMatch[];
}

export interface DecisionRequest {
  action: MatchDecisionAction;
  reason?: string; // required by server when action is OVERRIDE or REJECT
}

export interface DecisionResponse {
  match_id: string;
  operator_decision: MatchDecisionAction;
  decision_reason: string | null;
  recorded_at: string;
}

// ---------------------------------------------------------------------------
// OPERATOR: referral (F6)
// ---------------------------------------------------------------------------

export interface ReferralResponse {
  case_id: string;
  referral_id: string;
  referral_pdf_url: string;
  issued_at: string;
  locked: true;
}

// ---------------------------------------------------------------------------
// OPERATOR: audit trail (F7)
// ---------------------------------------------------------------------------

export interface AuditEvent {
  event_id: string;
  case_id: string;
  event_type: string; // e.g. "DOCUMENT_UPLOADED", "MATCH_APPROVED", "REFERRAL_ISSUED"
  actor: string; // "SYSTEM" or an operator display name
  summary: string;
  event_hash: string;
  previous_event_hash: string | null;
  created_at: string;
}

export interface AuditTrailResponse {
  case_id: string;
  events: AuditEvent[];
}

// ---------------------------------------------------------------------------
// Shared error shape
// ---------------------------------------------------------------------------

export interface ApiErrorBody {
  detail: string;
  code?: string;
}
