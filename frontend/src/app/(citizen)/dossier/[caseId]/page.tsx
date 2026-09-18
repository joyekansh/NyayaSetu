'use client';

/**
 * (citizen)/dossier/[caseId] — FR-8: The Case Dossier view.
 * OWNER: Akash.
 *
 * Shows the final output for STANDARD tier cases: extracted facts and matched
 * schemes with clause-level citations.
 * Enforces the hard gate (FR-7) — if the API returns 403 or gated=true,
 * it renders the gate notice instead of scheme data.
 */

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { HttpError } from '@/lib/httpClient';
import { citizenCaseApi } from '@/lib/citizenCaseApi';
import type { CaseDetail } from '@/types/api';

export default function CaseDossierPage() {
  const params = useParams<{ caseId: string }>();
  const caseId = params.caseId;

  const [caseData, setCaseData] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDossier = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await citizenCaseApi.get(caseId);
      setCaseData(data);
    } catch (err) {
      if (err instanceof HttpError) {
        if (err.status === 403) {
          // Gate enforcement from backend
          setError('This case has been gated for human review due to urgency.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Unable to load dossier. The server may be unavailable.');
      }
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void fetchDossier();
  }, [fetchDossier]);

  if (loading) {
    return <DossierSkeleton />;
  }

  if (error) {
    return (
      <div className="animate-slide-up card-flat text-center py-12 space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <span className="text-2xl">⚠️</span>
        </div>
        <h1 className="font-heading text-xl font-bold text-surface-900">
          Could not load dossier
        </h1>
        <p className="text-sm text-surface-500 max-w-md mx-auto">{error}</p>
        <div className="pt-4 flex justify-center gap-4">
          <Link href={`/status/${caseId}`} className="btn-secondary">
            Check Status
          </Link>
          <button onClick={fetchDossier} className="btn-primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!caseData) return null;

  // Gate enforcement on the frontend (if API returns gated=true but 200 OK)
  if (caseData.gated) {
    return (
      <div className="animate-slide-up space-y-6">
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-8 text-center shadow-card">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-200">
            <span className="text-3xl">🛡️</span>
          </div>
          <h1 className="font-heading text-2xl font-bold text-amber-900 mb-2">
            Priority Human Review Required
          </h1>
          <p className="text-amber-800 max-w-lg mx-auto">
            {caseData.gate_notice ??
              'Your case has been flagged as urgent (HIGH/CRITICAL tier). An automated advisory will not be generated. A legal aid worker will contact you directly.'}
          </p>
          <div className="mt-8">
            <Link href={`/status/${caseId}`} className="btn-primary">
              Back to Status
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-slide-up space-y-8">
      {/* Header */}
      <div>
        <p className="text-sm text-surface-500 mb-1">Case Dossier</p>
        <h1 className="font-heading text-2xl font-bold text-surface-900 sm:text-3xl">
          Legal Aid Assessment
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-surface-500">
          <span className="font-mono text-xs bg-surface-100 rounded-lg px-2.5 py-1">
            {caseId.slice(0, 8)}…
          </span>
          <span className="badge-standard">STANDARD TIER</span>
        </div>
      </div>

      {/* Matches Section */}
      <div className="space-y-4">
        <h2 className="font-heading text-xl font-bold text-surface-900">
          Eligible Schemes ({caseData.matches?.length ?? 0})
        </h2>
        
        {!caseData.matches || caseData.matches.length === 0 ? (
          <div className="card-flat text-center py-10">
            <p className="text-surface-500">No matching legal aid schemes found based on the provided documents.</p>
          </div>
        ) : (
          <div className="grid gap-5">
            {caseData.matches.map((match) => (
              <div key={match.id} className="card-flat border-l-4 border-l-brand-500 hover:-translate-y-1 transition-transform duration-200">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-heading text-lg font-semibold text-surface-900">
                      {match.scheme_name}
                    </h3>
                    <div className="mt-1 flex items-center gap-2 text-xs font-medium text-surface-500">
                      <span className="bg-surface-100 px-2 py-0.5 rounded-md">
                        Section {match.section_number}
                      </span>
                      <span>•</span>
                      <span className={match.final_confidence >= 0.8 ? 'text-emerald-600' : 'text-amber-600'}>
                        {Math.round(match.final_confidence * 100)}% Match
                      </span>
                    </div>
                  </div>
                </div>

                {/* Evidence Citation */}
                <div className="mt-4 rounded-xl bg-surface-50 p-4 border border-surface-200/50">
                  <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">
                    Clause Citation
                  </p>
                  <blockquote className="text-sm italic text-surface-800 border-l-2 border-brand-300 pl-3 py-1">
                    "{match.clause_text}"
                  </blockquote>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Extracted Facts Section */}
      <div className="space-y-4">
        <h2 className="font-heading text-xl font-bold text-surface-900">
          Verified Facts
        </h2>
        <div className="card-flat">
          <ul className="divide-y divide-surface-100">
            {caseData.documents.flatMap((doc) => doc.extracted_fields || []).length === 0 ? (
              <li className="py-4 text-center text-surface-500 text-sm">
                No facts extracted from documents.
              </li>
            ) : (
              caseData.documents.flatMap((doc) => doc.extracted_fields || []).map((field) => (
                <li key={field.id} className="py-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-surface-600 capitalize">
                    {field.field_name.replace(/_/g, ' ')}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-surface-900">
                      {field.field_value}
                    </span>
                    {field.is_operator_corrected && (
                      <span className="text-[10px] uppercase font-bold text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded">
                        Edited
                      </span>
                    )}
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

function DossierSkeleton() {
  return (
    <div className="animate-fade-in space-y-8">
      <div className="space-y-3">
        <div className="skeleton h-5 w-24" />
        <div className="skeleton h-9 w-64" />
        <div className="skeleton h-6 w-32" />
      </div>
      <div className="space-y-4">
        <div className="skeleton h-7 w-40" />
        <div className="card-flat space-y-4 h-48 skeleton" />
        <div className="card-flat space-y-4 h-48 skeleton" />
      </div>
    </div>
  );
}
