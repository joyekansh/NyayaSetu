/**
 * components/AuditTimeline.tsx
 *
 * Renders GET /cases/{id}/audit-trail as an ordered, append-only-looking
 * list (T4, F7). This is a judge-facing credibility signal for the
 * tamper-proof audit trail — the event_hash must be visibly rendered next
 * to each entry, truncated but present, so the hash-chaining reads as real
 * and inspectable rather than becoming just another plain activity feed.
 *
 * Entirely read-only: nothing here is editable or deletable, and there is
 * no edit/delete affordance anywhere in this component by design (F7).
 */

import type { AuditEvent } from "@/types/api";

interface AuditTimelineProps {
  events: AuditEvent[];
}

function truncateHash(hash: string): string {
  if (hash.length <= 12) return hash;
  return `${hash.slice(0, 5)}…${hash.slice(-4)}`;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function AuditTimeline({ events }: AuditTimelineProps) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No audit events recorded for this case yet.
      </p>
    );
  }

  return (
    <ol className="relative border-l border-slate-200 pl-6">
      {events.map((event, idx) => (
        <li key={event.event_id} className="mb-8 last:mb-0">
          <span className="absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-slate-400" />

          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="text-sm font-semibold text-slate-900">
              {event.event_type.replaceAll("_", " ")}
            </span>
            <time className="text-xs text-slate-400" dateTime={event.created_at}>
              {formatTimestamp(event.created_at)}
            </time>
          </div>

          <p className="mt-1 text-sm text-slate-600">{event.summary}</p>
          <p className="mt-1 text-xs text-slate-400">Actor: {event.actor}</p>

          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-slate-500">
            <span
              className="rounded bg-slate-100 px-1.5 py-0.5"
              title={event.event_hash}
            >
              hash: {truncateHash(event.event_hash)}
            </span>
            {event.previous_event_hash ? (
              <span
                className="rounded bg-slate-50 px-1.5 py-0.5 text-slate-400"
                title={event.previous_event_hash}
              >
                prev: {truncateHash(event.previous_event_hash)}
              </span>
            ) : (
              <span className="rounded bg-slate-50 px-1.5 py-0.5 text-slate-400">
                genesis event
              </span>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
