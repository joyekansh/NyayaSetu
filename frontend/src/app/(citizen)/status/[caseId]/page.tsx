'use client';

/**
 * (citizen)/status/[caseId] — FR-9: case status tracking.
 * OWNER: Akash.
 *
 * Shows a step-based progress view of the case pipeline. Handles the
 * backend-down case gracefully — renders a polite error/retry state
 * instead of crashing.
 */

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { HttpError } from '@/lib/httpClient';
import { citizenCaseApi } from '@/lib/citizenCaseApi';
import type { CaseDetail, CaseStatus } from '@/types/api';

const PIPELINE_STEPS: { status: CaseStatus; label: string; description: string }[] = [
  { status: 'RECEIVED', label: 'Submitted', description: 'Your case has been received.' },
  { status: 'EXTRACTED', label: 'Under Extraction', description: 'Documents are being read and fields extracted.' },
  { status: 'TRIAGED', label: 'Triage Complete', description: 'Urgency assessment has been run.' },
];

function stepIndex(status: CaseStatus): number {
  return PIPELINE_STEPS.findIndex((s) => s.status === status);
}

export default function CaseStatusPage() {
  const params = useParams<{ caseId: string }>();
  const caseId = params.caseId;

  const [caseData, setCaseData] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCase = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await citizenCaseApi.get(caseId);
      setCaseData(data);
    } catch (err) {
      if (err instanceof HttpError) {
        setError(err.message);
      } else {
        setError('Unable to load your case. The server may be unavailable — please try again shortly.');
      }
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void fetchCase();
  }, [fetchCase]);

  if (loading) {
    return <StatusSkeleton />;
  }

  if (error) {
    return (
      <div className="animate-slide-up">
        <div className="card-flat text-center py-12 space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <span className="text-2xl">⚠️</span>
          </div>
          <h1 className="font-heading text-xl font-bold text-surface-900">
            Could not load case
          </h1>
          <p className="text-sm text-surface-500 max-w-md mx-auto">{error}</p>
          <button onClick={fetchCase} className="btn-primary mt-4">
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!caseData) return null;

  const currentIdx = stepIndex(caseData.status);
  const tierColor =
    caseData.urgency_tier === 'CRITICAL'
      ? 'badge-critical'
      : caseData.urgency_tier === 'HIGH'
        ? 'badge-high'
        : 'badge-standard';

  return (
    <div className="animate-slide-up space-y-8">
      {/* Header */}
      <div>
        <p className="text-sm text-surface-500 mb-1">Case Status</p>
        <h1 className="font-heading text-2xl font-bold text-surface-900 sm:text-3xl">
          Tracking your request
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-surface-500">
          <span className="font-mono text-xs bg-surface-100 rounded-lg px-2.5 py-1">
            {caseId.slice(0, 8)}…
          </span>
          {caseData.urgency_tier && !['RECEIVED', 'EXTRACTED'].includes(caseData.status) && (
            <span className={tierColor}>{caseData.urgency_tier}</span>
          )}
          {caseData.district && (
            <span>📍 {caseData.district}</span>
          )}
        </div>
      </div>

      {/* Gate notice */}
      {caseData.gated && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 animate-slide-up">
          <div className="flex items-start gap-3">
            <span className="text-xl">🛡️</span>
            <div>
              <p className="font-heading font-semibold text-amber-900">
                Your case has been prioritised for human review
              </p>
              <p className="mt-1 text-sm text-amber-800">
                {caseData.gate_notice ??
                  'Due to the urgency of your situation, a legal aid worker will review your case directly. No automated advisory will be shown.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Pipeline steps */}
      <div className="card-flat">
        <h2 className="font-heading text-base font-semibold text-surface-900 mb-4">
          Progress
        </h2>
        <ol className="space-y-1">
          {PIPELINE_STEPS.map((step, idx) => {
            const isDone = idx < currentIdx;
            const isCurrent = idx === currentIdx;

            return (
              <li key={step.status} className="flex items-start gap-4">
                {/* Vertical line + dot */}
                <div className="flex flex-col items-center">
                  <div
                    className={[
                      'flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-colors duration-300',
                      isCurrent
                        ? 'bg-brand-600 text-white shadow-glow'
                        : isDone
                          ? 'bg-brand-100 text-brand-600'
                          : 'bg-surface-100 text-surface-400',
                    ].join(' ')}
                  >
                    {isDone ? '✓' : idx + 1}
                  </div>
                  {idx < PIPELINE_STEPS.length - 1 && (
                    <div
                      className={[
                        'w-0.5 flex-1 min-h-[24px] transition-colors duration-300',
                        idx < currentIdx ? 'bg-brand-300' : 'bg-surface-200',
                      ].join(' ')}
                    />
                  )}
                </div>

                {/* Step label */}
                <div className={['pb-4', idx === PIPELINE_STEPS.length - 1 ? 'pb-0' : ''].join(' ')}>
                  <p
                    className={[
                      'text-sm font-medium',
                      isCurrent
                        ? 'text-brand-700'
                        : isDone
                          ? 'text-surface-700'
                          : 'text-surface-400',
                    ].join(' ')}
                  >
                    {step.label}
                  </p>
                  {(isCurrent || isDone) && (
                    <p className="text-xs text-surface-500 mt-0.5">{step.description}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>



      {/* Actions */}
      {!caseData.gated && caseData.status === 'MATCHED' && (
        <Link href={`/dossier/${caseId}`} className="btn-primary inline-flex">
          View your case dossier →
        </Link>
      )}

      <button onClick={fetchCase} className="btn-secondary">
        Refresh status
      </button>
    </div>
  );
}

function StatusSkeleton() {
  return (
    <div className="animate-fade-in space-y-6">
      <div className="space-y-3">
        <div className="skeleton h-5 w-24" />
        <div className="skeleton h-9 w-72" />
        <div className="skeleton h-4 w-48" />
      </div>
      <div className="card-flat space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="skeleton h-8 w-8 rounded-full" />
            <div className="skeleton h-4 w-40" />
          </div>
        ))}
      </div>
    </div>
  );
}
