"use client";

/**
 * app/(operator)/case/[caseId]/page.tsx
 *
 * F3: extracted fields alongside the original document image, with a
 *     visual flag on any low-confidence field. (Field *correction* UI is
 *     Akash/shared — confirm ownership split; this page only displays.)
 * F4: every candidate match with Act name, section number, verbatim
 *     clause text, and confidence — via MatchCard.
 * F5: approve/override/reject, reason required for override/reject.
 * F6: issuing a referral locks the case (read-only) in the UI.
 * F8: gated cases show no auto-generated match until reclassified —
 *     this page renders a gated banner instead of attempting /matches
 *     against a case that will 403.
 * T2: renders strictly through typed interfaces from types/api.ts —
 *     never reach into raw/untyped JSON in JSX.
 */

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import MatchCard, { matchCardPropsFrom } from "@/components/MatchCard";
import { getCase, getMatches, postDecision, postReferral } from "@/lib/caseApi";
import { ApiError, GatedCaseError } from "@/lib/apiClient";
import type { CaseDetail, MatchDecisionAction, SchemeMatch } from "@/types/api";

export default function CaseDetailPage() {
  const params = useParams<{ caseId: string }>();
  const router = useRouter();
  const caseId = params.caseId;

  const [caseDetail, setCaseDetail] = useState<CaseDetail | null>(null);
  const [matches, setMatches] = useState<SchemeMatch[] | null>(null);
  const [gatedMessage, setGatedMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [issuingReferral, setIssuingReferral] = useState(false);
  const [referralError, setReferralError] = useState<string | null>(null);

  const loadCase = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setGatedMessage(null);
    try {
      const detail = await getCase(caseId);
      setCaseDetail(detail);

      if (detail.is_gated) {
        // F8: don't even attempt /matches on a gated case — the gate
        // fires here in the UI intentionally, matching what gate.py
        // enforces server-side.
        setMatches(null);
      } else {
        try {
          const matchesResponse = await getMatches(caseId);
          setMatches(matchesResponse.matches);
        } catch (err) {
          if (err instanceof GatedCaseError) {
            // T5: the 403 branch — render a clear message, never a crash
            // or a generic error screen.
            setGatedMessage(err.message);
            setMatches(null);
          } else {
            throw err;
          }
        }
      }
    } catch (err) {
      setLoadError(
        err instanceof ApiError ? err.message : "Could not load this case."
      );
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    loadCase();
  }, [loadCase]);

  async function handleDecision(
    matchId: string,
    action: MatchDecisionAction,
    reason?: string
  ) {
    await postDecision(caseId, matchId, { action, reason });
    setMatches((prev) =>
      prev
        ? prev.map((m) =>
            m.match_id === matchId
              ? { ...m, operator_decision: action, decision_reason: reason ?? null }
              : m
          )
        : prev
    );
  }

  async function handleIssueReferral() {
    setIssuingReferral(true);
    setReferralError(null);
    try {
      await postReferral(caseId);
      await loadCase(); // refresh -> caseDetail.locked flips to true
    } catch (err) {
      setReferralError(
        err instanceof ApiError ? err.message : "Could not issue referral."
      );
    } finally {
      setIssuingReferral(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-sm text-slate-500">Loading case…</p>
      </main>
    );
  }

  if (loadError || !caseDetail) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8">
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {loadError ?? "Case not found."}
        </p>
        <Link href="/queue" className="mt-4 inline-block text-sm text-slate-600 underline">
          Back to queue
        </Link>
      </main>
    );
  }

  // F6: gate referral issuance on every match having a recorded decision
  // (approve/override/reject), with at least one approval — not on every
  // match being approved. A case can legitimately have some matches
  // rejected/overridden and still be referable on the approved ones.
  const everyMatchDecided =
    matches !== null &&
    matches.length > 0 &&
    matches.every((m) => m.operator_decision !== null);
  const hasApproval =
    matches !== null && matches.some((m) => m.operator_decision === "APPROVE");
  const canIssueReferral = everyMatchDecided && hasApproval;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/queue" className="text-sm text-slate-500 hover:underline">
            ← Back to queue
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">
            {caseDetail.citizen_display_name}
          </h1>
          <p className="text-sm text-slate-500">
            {caseDetail.case_id} · {caseDetail.status}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {caseDetail.is_gated && (
            <span className="rounded-full border border-slate-900 bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
              Gated — pending triage
            </span>
          )}
          {caseDetail.locked && (
            <span className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              Referral issued — read only
            </span>
          )}
          <Link
            href={`/audit/${caseDetail.case_id}`}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            View audit trail
          </Link>
        </div>
      </div>

      {/* F3: extracted fields alongside the document image */}
      <section className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">Original document</h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={caseDetail.document_image_url}
            alt="Original submitted document"
            className="mt-3 w-full rounded-md border border-slate-100"
          />
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">Extracted fields</h2>
          <dl className="mt-3 space-y-3">
            {caseDetail.extracted_fields.map((field) => (
              <div
                key={field.field_name}
                className={`rounded-md border p-2 ${
                  field.is_low_confidence
                    ? "border-amber-300 bg-amber-50"
                    : "border-slate-100"
                }`}
              >
                <div className="flex items-center justify-between">
                  <dt className="text-xs font-medium text-slate-500">
                    {field.field_name}
                  </dt>
                  {field.is_low_confidence && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                      Needs review — low OCR confidence
                    </span>
                  )}
                </div>
                <dd className="mt-1 text-sm text-slate-900">{field.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* F4 / F5: scheme matches */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold text-slate-900">Candidate scheme matches</h2>

        {caseDetail.is_gated && (
          <p className="mt-3 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            This case is gated pending triage review. Scheme matches are hidden
            until the case is reclassified — this is intentional, not an error.
          </p>
        )}

        {!caseDetail.is_gated && gatedMessage && (
          <p className="mt-3 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            {gatedMessage}
          </p>
        )}

        {!caseDetail.is_gated && matches && matches.length === 0 && (
          <p className="mt-3 text-sm text-slate-500">No candidate matches found.</p>
        )}

        {!caseDetail.is_gated && matches && matches.length > 0 && (
          <div className="mt-3 space-y-4">
            {matches.map((match) => (
              <MatchCard
                key={match.match_id}
                {...matchCardPropsFrom(match)}
                readOnly={caseDetail.locked}
                onDecide={(action, reason) =>
                  handleDecision(match.match_id, action, reason)
                }
              />
            ))}
          </div>
        )}
      </section>

      {/* F6: referral issuance */}
      {!caseDetail.is_gated && matches && matches.length > 0 && (
        <section className="mt-8 flex items-center gap-3 border-t border-slate-100 pt-6">
          <button
            type="button"
            onClick={handleIssueReferral}
            disabled={caseDetail.locked || issuingReferral || !canIssueReferral}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
          >
            {caseDetail.locked
              ? "Referral already issued"
              : issuingReferral
              ? "Issuing referral…"
              : "Issue referral"}
          </button>
          {!canIssueReferral && !caseDetail.locked && (
            <p className="text-xs text-slate-500">
              Every match needs a recorded decision (and at least one approval)
              before a referral can be issued.
            </p>
          )}
          {referralError && (
            <p className="text-sm text-red-600">{referralError}</p>
          )}
        </section>
      )}
    </main>
  );
}
