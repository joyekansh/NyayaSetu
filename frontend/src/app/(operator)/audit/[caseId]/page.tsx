"use client";

/**
 * app/(operator)/audit/[caseId]/page.tsx
 *
 * F7: full, read-only, chronological timeline of every automated and human
 * action on a case. Nothing editable or deletable anywhere on this screen —
 * that's by design (audit/repository.py has no update/delete methods at
 * all), and the UI should never even gesture at those affordances.
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AuditTimeline from "@/components/AuditTimeline";
import { getAuditTrail } from "@/lib/caseApi";
import { ApiError } from "@/lib/apiClient";
import type { AuditEvent } from "@/types/api";

export default function AuditTrailPage() {
  const params = useParams<{ caseId: string }>();
  const caseId = params.caseId;

  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await getAuditTrail(caseId);
        if (!cancelled) setEvents(response.events);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : "Could not load the audit trail."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href={`/case/${caseId}`} className="text-sm text-slate-500 hover:underline">
        ← Back to case
      </Link>

      <h1 className="mt-2 text-xl font-semibold text-slate-900">
        Audit trail — {caseId}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        A read-only, hash-chained ledger of every action taken on this case.
        Each event references the hash of the one before it, so any edit to
        history would break the chain.
      </p>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6">
        {loading ? (
          <p className="text-sm text-slate-500">Loading audit trail…</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : (
          <AuditTimeline events={events} />
        )}
      </div>
    </main>
  );
}
