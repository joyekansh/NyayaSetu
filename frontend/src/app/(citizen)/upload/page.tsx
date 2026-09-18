'use client';

/**
 * (citizen)/upload — FR-1..FR-4. Consent → intake questions → document capture.
 * OWNER: Akash.
 *
 * The case row is created first so every subsequent upload has a case_id to
 * attach to, and so a half-finished kiosk session is still recoverable by an
 * operator rather than lost.
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import CameraCapture from '@/components/CameraCapture';
import { HttpError } from '@/lib/httpClient';
import { citizenCaseApi } from '@/lib/citizenCaseApi';
import { documentApi } from '@/lib/documentApi';
import type { CaseSummary, DocType, Language } from '@/types/api';

const DOC_TYPES: { value: DocType; label: string; icon: string }[] = [
  { value: 'income_cert', label: 'Income certificate', icon: '📄' },
  { value: 'eviction_notice', label: 'Eviction notice', icon: '🏠' },
  { value: 'aadhaar', label: 'Aadhaar card', icon: '🪪' },
  { value: 'fir', label: 'FIR copy', icon: '📋' },
  { value: 'wage_slip', label: 'Wage slip', icon: '💰' },
  { value: 'medical_report', label: 'Medical report', icon: '🏥' },
];

const GRIEVANCE_OPTIONS = [
  'Eviction or housing',
  'Unpaid wages',
  'Domestic violence',
  'Police or detention',
  'Compensation claim',
  'Something else',
];

interface Staged {
  file: Blob;
  previewUrl: string;
  docType: DocType;
  uploadedId?: string;
}

export default function CitizenUploadPage() {
  const router = useRouter();

  const [consent, setConsent] = useState(false);
  const [district, setDistrict] = useState('');
  const [language, setLanguage] = useState<Language>('en');
  const [grievance, setGrievance] = useState(GRIEVANCE_OPTIONS[0]);
  const [description, setDescription] = useState('');
  const [monthlyIncome, setMonthlyIncome] = useState('');

  const [docType, setDocType] = useState<DocType>('income_cert');
  const [staged, setStaged] = useState<Staged[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    consent && district.trim() !== '' && staged.length > 0 && !submitting;

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      setProgress('Creating your case…');
      const created: CaseSummary = await citizenCaseApi.create({
        assisted_mode: false,
        district: district.trim(),
        language,
        intake_answers: {
          grievance_type: grievance,
          description: description.trim(),
          declared_monthly_income: monthlyIncome.trim(),
        },
        consent_given: true,
      });

      for (let i = 0; i < staged.length; i += 1) {
        const item = staged[i];
        setProgress(`Uploading document ${i + 1} of ${staged.length}…`);
        await documentApi.upload({
          caseId: created.id,
          file: item.file,
          docType: item.docType,
          filename: `${item.docType}.jpg`,
        });
      }

      router.push(`/status/${created.id}`);
    } catch (err) {
      setError(
        err instanceof HttpError
          ? err.message
          : 'Something went wrong. Your documents were not sent.',
      );
      setProgress(null);
      setSubmitting(false);
    }
  }

  return (
    <div className="animate-slide-up">
      {/* Hero section */}
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold text-surface-900 sm:text-4xl">
          Start a legal aid request
        </h1>
        <p className="mt-3 max-w-prose text-base text-surface-500 leading-relaxed">
          Answer a few questions and add photos of your documents. A legal aid
          worker reviews every request before any result is issued.
        </p>
      </div>

      {/* Intake form */}
      <div className="space-y-8">
        {/* ---- Section: About your situation ---- */}
        <section className="card-flat space-y-5">
          <div className="flex items-center gap-3 mb-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 text-brand-600 text-sm font-bold">1</span>
            <h2 className="font-heading text-lg font-semibold text-surface-900">About your situation</h2>
          </div>

          <Field label="District">
            <input
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              placeholder="e.g. Vellore"
              className="input-field"
            />
          </Field>

          <Field label="What do you need help with?">
            <select
              value={grievance}
              onChange={(e) => setGrievance(e.target.value)}
              className="input-field"
            >
              {GRIEVANCE_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Describe what happened">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Include dates and anything urgent, such as a deadline on a notice."
              className="input-field resize-none"
            />
          </Field>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Monthly household income (₹)">
              <input
                inputMode="numeric"
                value={monthlyIncome}
                onChange={(e) => setMonthlyIncome(e.target.value)}
                placeholder="e.g. 8000"
                className="input-field"
              />
            </Field>

            <Field label="Language">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                className="input-field"
              >
                <option value="en">English</option>
                <option value="hi">हिन्दी</option>
              </select>
            </Field>
          </div>
        </section>

        {/* ---- Section: Documents ---- */}
        <section className="card-flat space-y-5">
          <div className="flex items-center gap-3 mb-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 text-brand-600 text-sm font-bold">2</span>
            <h2 className="font-heading text-lg font-semibold text-surface-900">Your documents</h2>
          </div>

          <Field label="What is this document?">
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as DocType)}
              className="input-field"
            >
              {DOC_TYPES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.icon} {d.label}
                </option>
              ))}
            </select>
          </Field>

          <CameraCapture
            disabled={submitting}
            onCapture={(file, previewUrl) =>
              setStaged((prev) => [...prev, { file, previewUrl, docType }])
            }
          />

          {staged.length > 0 && (
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {staged.map((item, i) => (
                <li
                  key={item.previewUrl}
                  className="group relative overflow-hidden rounded-xl border border-surface-200 bg-surface-50 animate-slide-up"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.previewUrl}
                    alt={`${item.docType} preview`}
                    className="h-32 w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="flex items-center justify-between px-3 py-2 text-xs">
                    <span className="font-medium text-surface-700">{labelFor(item.docType)}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setStaged((prev) => prev.filter((_, idx) => idx !== i))
                      }
                      className="text-danger font-medium hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---- Section: Consent ---- */}
        <section className="card-flat">
          <div className="flex items-center gap-3 mb-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 text-brand-600 text-sm font-bold">3</span>
            <h2 className="font-heading text-lg font-semibold text-surface-900">Consent</h2>
          </div>

          <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-surface-200 bg-surface-50 p-4 transition-colors hover:bg-brand-50 hover:border-brand-200">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-sm text-surface-700 leading-relaxed">
              I agree that NyayaSetu may store and process these documents to
              check which legal aid schemes apply to me, under the{' '}
              <strong>Digital Personal Data Protection Act, 2023</strong>.
            </span>
          </label>
        </section>

        {/* ---- Error / Submit ---- */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 animate-slide-up" role="alert">
            {error}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pb-4">
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="btn-primary w-full sm:w-auto"
          >
            {submitting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Sending…
              </>
            ) : (
              'Send for review'
            )}
          </button>
          {progress && (
            <span className="text-sm font-medium text-brand-600 animate-pulse text-center sm:text-left w-full sm:w-auto">
              {progress}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium text-surface-700">{label}</span>
      {children}
    </label>
  );
}

function labelFor(value: DocType): string {
  return DOC_TYPES.find((d) => d.value === value)?.label ?? value;
}
