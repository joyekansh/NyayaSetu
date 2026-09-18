import { apiFetch } from "./apiClient";
import {
  mockAuditTrailByCaseId,
  mockCaseDetailByCaseId,
  mockMatchesByCaseId,
  mockQueueItems,
} from "./mockData";
import { GatedCaseError } from "./apiClient";
import type {
  AuditEvent,
  CaseDetail,
  MatchDecisionBody,
  QueueItem,
  ReferralReceipt,
  SchemeMatch,
} from "@/types/api";

const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

function mockDelay<T>(value: T, ms = 300): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export async function getQueue(): Promise<{ items: QueueItem[] }> {
  if (USE_MOCKS) return mockDelay({ items: mockQueueItems });
  return apiFetch<{ items: QueueItem[] }>("/queue");
}

export async function getCase(caseId: string): Promise<CaseDetail> {
  if (USE_MOCKS) {
    const detail = mockCaseDetailByCaseId[caseId];
    if (!detail) throw new Error(`No mock case detail for ${caseId}`);
    return mockDelay(detail);
  }
  return apiFetch<CaseDetail>(`/cases/${caseId}`);
}

export async function getMatches(caseId: string): Promise<SchemeMatch[]> {
  if (USE_MOCKS) {
    const detail = mockCaseDetailByCaseId[caseId];
    if (detail?.gated) {
      throw new GatedCaseError(
        "This case is gated pending triage review. You're not authorized to view matches for this case tier yet."
      );
    }
    const matches = mockMatchesByCaseId[caseId];
    if (!matches) throw new Error(`No mock matches for ${caseId}`);
    return mockDelay(matches);
  }
  const data = await apiFetch<{ matches: SchemeMatch[] }>(`/cases/${caseId}/matches`);
  return data.matches;
}

export async function postDecision(
  caseId: string,
  matchId: string,
  payload: MatchDecisionBody
): Promise<SchemeMatch> {
  if (USE_MOCKS) {
    const match = mockMatchesByCaseId[caseId]?.find((m) => m.id === matchId);
    if (!match) throw new Error("Match not found");
    return mockDelay({
      ...match,
      operator_decision: payload.decision,
      decision_reason: payload.reason,
      decided_at: new Date().toISOString(),
    });
  }
  return apiFetch<SchemeMatch>(
    `/cases/${caseId}/matches/${matchId}/decision`,
    { method: "POST", body: payload }
  );
}

export async function postReferral(caseId: string, notes: string): Promise<ReferralReceipt> {
  if (USE_MOCKS) {
    return mockDelay({
      referral_id: `ref_${caseId}`,
      case_id: caseId,
      referred_to: "Legal Aid Clinic",
      document_url: "/mock/referral.pdf",
      document_hash: "mockhash",
      issued_at: new Date().toISOString(),
    });
  }
  return apiFetch<ReferralReceipt>(`/cases/${caseId}/referral`, {
    method: "POST",
    body: { notes, referred_to: "Legal Aid Clinic" }
  });
}

export async function getAuditTrail(
  caseId: string
): Promise<{ events: AuditEvent[] }> {
  if (USE_MOCKS) {
    const events = mockAuditTrailByCaseId[caseId] || [];
    return mockDelay({ events });
  }
  return apiFetch<{ events: AuditEvent[] }>(`/cases/${caseId}/audit-trail`);
}
