/**
 * lib/caseApi.ts
 *
 * Typed functions, one per endpoint Joy's pages call (T6). Pages and
 * components should never call fetch() directly — everything routes
 * through here so the mock/real switch and error handling stay in one
 * place.
 *
 * Set NEXT_PUBLIC_USE_MOCKS=true in .env.local to develop against
 * lib/mockData.ts before Riya's endpoints are live. Flip it off (or unset)
 * to hit the real backend. Per the integration brief: aim to be off mocks
 * for getQueue/getCase by the ~18h checkpoint.
 */

import { apiFetch } from "./apiClient";
import {
  mockAuditTrailByCaseId,
  mockCaseDetailByCaseId,
  mockMatchesByCaseId,
  mockQueueResponse,
} from "./mockData";
import { GatedCaseError } from "./apiClient";
import type {
  AuditTrailResponse,
  CaseDetail,
  DecisionRequest,
  DecisionResponse,
  MatchesResponse,
  QueueResponse,
  ReferralResponse,
} from "@/types/api";

const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

function mockDelay<T>(value: T, ms = 300): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export async function getQueue(): Promise<QueueResponse> {
  if (USE_MOCKS) return mockDelay(mockQueueResponse);
  return apiFetch<QueueResponse>("/queue");
}

export async function getCase(caseId: string): Promise<CaseDetail> {
  if (USE_MOCKS) {
    const detail = mockCaseDetailByCaseId[caseId];
    if (!detail) throw new Error(`No mock case detail for ${caseId}`);
    return mockDelay(detail);
  }
  return apiFetch<CaseDetail>(`/cases/${caseId}`);
}

export async function getMatches(caseId: string): Promise<MatchesResponse> {
  if (USE_MOCKS) {
    const detail = mockCaseDetailByCaseId[caseId];
    if (detail?.is_gated) {
      throw new GatedCaseError(
        "This case is gated pending triage review. You're not authorized to view matches for this case tier yet."
      );
    }
    const matches = mockMatchesByCaseId[caseId];
    if (!matches) throw new Error(`No mock matches for ${caseId}`);
    return mockDelay(matches);
  }
  return apiFetch<MatchesResponse>(`/cases/${caseId}/matches`);
}

export async function postDecision(
  caseId: string,
  matchId: string,
  payload: DecisionRequest
): Promise<DecisionResponse> {
  if ((payload.action === "OVERRIDE" || payload.action === "REJECT") && !payload.reason?.trim()) {
    // Client-side guard only — see T7. Server (operator/router.py) is the
    // real enforcement; this just avoids a round trip for the common case.
    throw new Error("A reason is required to override or reject a match.");
  }
  if (USE_MOCKS) {
    return mockDelay({
      match_id: matchId,
      operator_decision: payload.action,
      decision_reason: payload.reason ?? null,
      recorded_at: new Date().toISOString(),
    });
  }
  return apiFetch<DecisionResponse>(
    `/cases/${caseId}/matches/${matchId}/decision`,
    { method: "POST", body: payload }
  );
}

export async function postReferral(caseId: string): Promise<ReferralResponse> {
  if (USE_MOCKS) {
    return mockDelay({
      case_id: caseId,
      referral_id: `ref_${caseId}`,
      referral_pdf_url: "/mock/referral.pdf",
      issued_at: new Date().toISOString(),
      locked: true as const,
    });
  }
  return apiFetch<ReferralResponse>(`/cases/${caseId}/referral`, {
    method: "POST",
  });
}

export async function getAuditTrail(
  caseId: string
): Promise<AuditTrailResponse> {
  if (USE_MOCKS) {
    const trail = mockAuditTrailByCaseId[caseId];
    if (!trail) return mockDelay({ case_id: caseId, events: [] });
    return mockDelay(trail);
  }
  return apiFetch<AuditTrailResponse>(`/cases/${caseId}/audit-trail`);
}
