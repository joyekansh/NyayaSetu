"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getQueue } from "@/lib/caseApi";
import { ApiError } from "@/lib/apiClient";
import type { QueueItem, UrgencyTier } from "@/types/api";

const TIER_ORDER: Record<UrgencyTier, number> = {
  CRITICAL: 0,
  HIGH: 1,
  STANDARD: 2,
};

const TIER_STYLES: Record<UrgencyTier, string> = {
  CRITICAL: "bg-red-100 text-red-800 border-red-200",
  HIGH: "bg-amber-100 text-amber-800 border-amber-200",
  STANDARD: "bg-slate-100 text-slate-700 border-slate-200",
};

const REFETCH_INTERVAL_MS = 12_000;

function sortByUrgency(items: QueueItem[]): QueueItem[] {
  return [...items].sort((a, b) => {
    const tierDiff = TIER_ORDER[a.urgency_tier] - TIER_ORDER[b.urgency_tier];
    if (tierDiff !== 0) return tierDiff;
    return a.sla_seconds_remaining - b.sla_seconds_remaining;
  });
}

function useSlaCountdown(initialSecondsRemaining: number): { text: string; overdue: boolean } {
  const [seconds, setSeconds] = useState(initialSecondsRemaining);

  useEffect(() => {
    setSeconds(initialSecondsRemaining);
  }, [initialSecondsRemaining]);

  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, []);

  const overdue = seconds <= 0;
  const abs = Math.abs(seconds);
  const hours = Math.floor(abs / 3600);
  const minutes = Math.floor((abs % 3600) / 60);
  const text = `${overdue ? "Overdue by " : ""}${hours}h ${minutes}m${overdue ? "" : " left"}`;
  return { text, overdue };
}

function QueueRow({ item }: { item: QueueItem }) {
  const sla = useSlaCountdown(item.sla_seconds_remaining);

  return (
    <Link
      href={`/case/${item.case_id}`}
      className="grid grid-cols-[auto_1fr_auto] items-center gap-4 border-b border-slate-100 px-4 py-3 last:border-b-0 hover:bg-slate-50"
    >
      <span
        className={`w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${TIER_STYLES[item.urgency_tier]}`}
      >
        {item.urgency_tier}
      </span>

      <div>
        <p className="text-sm font-medium text-slate-900">
          Case #{item.case_id.slice(0, 8)}
        </p>
        <p className="text-xs text-slate-500">
          District: {item.district ?? 'Unknown'} · {item.document_count} doc(s) · {item.status}
        </p>
      </div>

      <span className={`text-sm font-medium ${sla.overdue ? "text-red-600" : "text-slate-600"}`}>
        {sla.text}
      </span>
    </Link>
  );
}

export default function QueuePage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    try {
      const response = await getQueue();
      setItems(sortByUrgency(response.items));
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not load the queue. Retrying shortly."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
    const id = setInterval(fetchQueue, REFETCH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchQueue]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-xl font-semibold text-slate-900">Triage Queue</h1>
      <p className="mt-1 text-sm text-slate-500">
        Sorted by urgency. Refreshes automatically every 12 seconds.
      </p>

      {error && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {loading ? (
          <p className="px-4 py-6 text-sm text-slate-500">Loading queue…</p>
        ) : items.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">
            No open cases right now.
          </p>
        ) : (
          items.map((item) => <QueueRow key={item.case_id} item={item} />)
        )}
      </div>
    </main>
  );
}
