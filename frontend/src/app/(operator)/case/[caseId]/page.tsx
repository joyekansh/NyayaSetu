"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import MatchCard, { matchCardPropsFrom } from "@/components/MatchCard";
import { getCase, getMatches, postDecision, postReferral } from "@/lib/caseApi";
import { ApiError, GatedCaseError } from "@/lib/apiClient";
import type { CaseDetail, OperatorDecision, SchemeMatch } from "@/types/api";

export default function CaseDetailPage() {
  const params = useParams<{ caseId: string }>();
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

      if (detail.gated) {
        setMatches(null);
      } else {
        setMatches(detail.matches);
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
    action: OperatorDecision,
    reason?: string
  ) {
    if (action === 'pending') return;
    await postDecision(caseId, matchId, { decision: action, reason: reason ?? '', confidence_at_decision: 1 });
    setMatches((prev) =>
      prev
        ? prev.map((m) =>
            m.id === matchId
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
      await postReferral(caseId, "Referral note");
      await loadCase(); 
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

  const locked = caseDetail.status === 'REFERRED';

  const everyMatchDecided =
    matches !== null &&
    matches.length > 0 &&
    matches.every((m) => m.operator_decision !== 'pending');
  const hasApproval =
    matches !== null && matches.some((m) => m.operator_decision === "approved");
  const canIssueReferral = everyMatchDecided && hasApproval;

  const doc = caseDetail.documents?.[0];

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/queue" className="text-sm text-slate-500 hover:underline">
            ← Back to queue
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">
            Case #{caseDetail.id.slice(0, 8)}
          </h1>
          <p className="text-sm text-slate-500">
            {caseDetail.id} · {caseDetail.status}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {caseDetail.gated && (
            <span className="rounded-full border border-slate-900 bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
              Gated — pending triage
            </span>
          )}
          {locked && (
            <span className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              Referral issued — read only
            </span>
          )}
          <Link
            href={`/audit/${caseDetail.id}`}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            View audit trail
          </Link>
        </div>
      </div>

      {caseDetail.triage_reasoning && (
        <div className="mt-4 rounded-md border border-brand-200 bg-brand-50 p-4">
          <h2 className="text-sm font-semibold text-brand-900">Triage Reasoning</h2>
          <p className="mt-1 text-sm text-brand-800 leading-relaxed">
            {caseDetail.triage_reasoning}
          </p>
        </div>
      )}

      <section className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">Original document</h2>
          {doc?.doc_type === 'speech_recording' ? (
            doc.preview_url ? (
              <div className="mt-3 w-full rounded-md border border-slate-100 bg-slate-50 p-4 flex justify-center">
                <audio src={doc.preview_url} controls className="w-full" />
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">Audio recording is unavailable.</p>
            )
          ) : doc?.preview_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={doc.preview_url}
              alt="Original submitted document"
              className="mt-3 w-full rounded-md border border-slate-100"
            />
          ) : (
            <p className="mt-3 text-sm text-slate-500">No document preview available.</p>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">Extracted fields</h2>
          <dl className="mt-3 space-y-3">
            {doc?.extracted_fields?.map((field) => {
              const isLowConfidence = field.confidence !== null && field.confidence < 0.8;
              return (
                <div
                  key={field.field_name}
                  className={`rounded-md border p-2 ${
                    isLowConfidence
                      ? "border-amber-300 bg-amber-50"
                      : "border-slate-100"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <dt className="text-xs font-medium text-slate-500">
                      {field.field_name}
                    </dt>
                    {isLowConfidence && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                        Needs review — low OCR confidence
                      </span>
                    )}
                  </div>
                  <dd className="mt-1 text-sm text-slate-900">{field.field_value}</dd>
                </div>
              );
            })}
          </dl>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-slate-900">Candidate scheme matches</h2>

        {caseDetail.gated && (
          <p className="mt-3 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            This case is gated pending triage review. Scheme matches are hidden
            until the case is reclassified — this is intentional, not an error.
          </p>
        )}

        {!caseDetail.gated && gatedMessage && (
          <p className="mt-3 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            {gatedMessage}
          </p>
        )}

        {!caseDetail.gated && matches && matches.length === 0 && (
          <p className="mt-3 text-sm text-slate-500">No candidate matches found.</p>
        )}

        {!caseDetail.gated && matches && matches.length > 0 && (
          <div className="mt-3 space-y-4">
            {matches.map((match) => (
              <MatchCard
                key={match.id}
                {...matchCardPropsFrom(match)}
                readOnly={locked}
                onDecide={(action, reason) =>
                  handleDecision(match.id, action, reason)
                }
              />
            ))}
          </div>
        )}
      </section>

      {!caseDetail.gated && matches && matches.length > 0 && (
        <section className="mt-8 flex items-center gap-3 border-t border-slate-100 pt-6">
          <button
            type="button"
            onClick={handleIssueReferral}
            disabled={locked || issuingReferral || !canIssueReferral}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
          >
            {locked
              ? "Referral already issued"
              : issuingReferral
              ? "Issuing referral…"
              : "Issue referral"}
          </button>
          {!canIssueReferral && !locked && (
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
