/**
 * lib/citizenCaseApi.ts — the handful of case endpoints citizen pages call.
 * OWNER: Akash.
 *
 * Deliberately not named `caseApi.ts` — that file is Joy's (queue, matches,
 * decisions, referral, audit-trail: the operator-side calls). This covers only
 * what FR-1/FR-4/FR-9 need: OTP login, creating a case, and reading one case's
 * own status/dossier. If the two clients get unified post-hackathon, this is
 * the subset that survives; the rest stays behind role checks Joy's side owns.
 */

import { citizenAuth, request } from './httpClient';
import type {
  CaseDetail,
  CaseSummary,
  CreateCaseBody,
  FieldCorrectionBody,
} from '@/types/api';

export const citizenAuthApi = {
  requestOtp: (phone: string) =>
    request<{ sent: boolean; expires_in: number }>('/auth/otp/request', {
      method: 'POST',
      body: { phone },
      authenticated: false,
    }),

  verifyOtp: async (phone: string, otp: string) => {
    const result = await request<{ access_token: string }>('/auth/otp/verify', {
      method: 'POST',
      body: { phone, otp },
      authenticated: false,
    });
    citizenAuth.save(result.access_token);
    return result;
  },
};

export const citizenCaseApi = {
  create: (payload: CreateCaseBody) =>
    request<CaseSummary>('/cases', { method: 'POST', body: payload }),

  /**
   * Used by (citizen)/status and (citizen)/dossier. For a gated case the
   * backend may either return `gated: true` with `matches: null`, or a bare
   * 403 from the gate — both are handled by callers via HttpError.isGated.
   * Confirm which shape Riya's endpoint actually returns.
   */
  get: (caseId: string, signal?: AbortSignal) =>
    request<CaseDetail>(`/cases/${caseId}`, { signal }),

  /**
   * Backs FieldEditor.tsx, which is Akash's component per roles.md. Note the
   * API table marks PATCH /cases/{id}/fields as Operator-auth — FieldEditor
   * is currently only wired into the citizen upload flow, so this will only
   * ever succeed there if a citizen-scoped correction path exists. If this
   * component gets reused inside Joy's operator case page later, that call
   * should go through her caseApi.ts instead, not this file.
   */
  correctField: (caseId: string, payload: FieldCorrectionBody) =>
    request<void>(`/cases/${caseId}/fields`, { method: 'PATCH', body: payload }),
};
