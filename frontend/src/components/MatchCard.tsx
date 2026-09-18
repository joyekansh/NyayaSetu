"use client";

import { useState } from "react";
import type { OperatorDecision, SchemeMatch } from "@/types/api";

interface MatchCardProps {
  scheme_name: string;
  act_name: string | null;
  section_number: string | null;
  clause_text: string;
  final_confidence: number;
  operator_decision: OperatorDecision;
  readOnly?: boolean;
  onDecide?: (action: OperatorDecision, reason?: string) => void | Promise<void>;
}

function confidenceLabel(score: number): { label: string; className: string } {
  if (score >= 0.8) return { label: "High confidence", className: "text-emerald-700 bg-emerald-50 border-emerald-200" };
  if (score >= 0.5) return { label: "Medium confidence", className: "text-amber-700 bg-amber-50 border-amber-200" };
  return { label: "Low confidence", className: "text-red-700 bg-red-50 border-red-200" };
}

export default function MatchCard({
  scheme_name,
  act_name,
  section_number,
  clause_text,
  final_confidence,
  operator_decision,
  readOnly = false,
  onDecide,
}: MatchCardProps) {
  const [pendingAction, setPendingAction] = useState<OperatorDecision | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confidence = confidenceLabel(final_confidence);
  const needsReason = pendingAction === "overridden" || pendingAction === "rejected";

  async function handleApprove() {
    if (!onDecide) return;
    setSubmitting(true);
    setError(null);
    try {
      await onDecide("approved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record decision.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmReasoned() {
    if (!onDecide || !pendingAction) return;
    if (!reason.trim()) {
      setError("A reason is required before this decision can be submitted.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onDecide(pendingAction, reason.trim());
      setPendingAction(null);
      setReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record decision.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{scheme_name}</h3>
          <p className="mt-0.5 text-sm text-slate-500">
            {act_name ?? 'Unknown Act'} — {section_number ?? 'Unknown Section'}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${confidence.className}`}
        >
          {confidence.label} · {Math.round(final_confidence * 100)}%
        </span>
      </div>

      <blockquote className="mt-4 rounded-md bg-slate-50 border border-slate-100 p-3 text-sm leading-relaxed text-slate-700">
        {clause_text}
      </blockquote>

      {operator_decision && operator_decision !== 'pending' && (
        <p className="mt-3 text-sm font-medium text-slate-600">
          Decision recorded: <span className="uppercase">{operator_decision}</span>
        </p>
      )}

      {!readOnly && (!operator_decision || operator_decision === 'pending') && (
        <div className="mt-4">
          {!pendingAction && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleApprove}
                disabled={submitting}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => setPendingAction("overridden")}
                disabled={submitting}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Override
              </button>
              <button
                type="button"
                onClick={() => setPendingAction("rejected")}
                disabled={submitting}
                className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          )}

          {needsReason && (
            <div className="mt-3 space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                Reason for {pendingAction === "overridden" ? "override" : "rejection"}
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-slate-300 p-2 text-sm focus:border-slate-500 focus:outline-none"
                placeholder="Required — explain why this match is being overridden or rejected."
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleConfirmReasoned}
                  disabled={submitting || !reason.trim()}
                  className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
                >
                  Confirm {pendingAction === "overridden" ? "override" : "rejection"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPendingAction(null);
                    setReason("");
                    setError(null);
                  }}
                  disabled={submitting}
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}

export function matchCardPropsFrom(match: SchemeMatch) {
  return {
    scheme_name: match.scheme_name,
    act_name: match.act_name,
    section_number: match.section_number,
    clause_text: match.clause_text,
    final_confidence: match.final_confidence,
    operator_decision: match.operator_decision,
  };
}
