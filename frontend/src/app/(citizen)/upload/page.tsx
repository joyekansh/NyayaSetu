'use client';

/**
 * (citizen)/upload — FR-1..FR-4.
 * New step order: Situation → Documents → Grievance → Consent
 * OWNER: Akash.
 *
 * No doc-type dropdown — the backend OCR auto-identifies the document.
 * Speech input (Hindi + English) is live via the Web Speech API.
 */

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import CameraCapture from '@/components/CameraCapture';
import { citizenAuth, HttpError } from '@/lib/httpClient';
import { citizenCaseApi } from '@/lib/citizenCaseApi';
import { documentApi } from '@/lib/documentApi';
import type { CaseSummary, Language } from '@/types/api';

// Extend Window for webkit prefix
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

interface Staged {
  file: Blob;
  previewUrl: string;
  isPdf: boolean;
}

export default function CitizenUploadPage() {
  const router = useRouter();

  // Step state
  const [step, setStep] = useState(1);

  // Step 1 — Situation
  const [district, setDistrict] = useState('');
  const [language, setLanguage] = useState<Language>('en');
  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [description, setDescription] = useState('');

  // Step 2 — Documents
  const [staged, setStaged] = useState<Staged[]>([]);

  // Step 3 — Grievance (free text + voice)
  const [grievance, setGrievance] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Step 4 — Consent
  const [consent, setConsent] = useState(false);

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const step1Valid = district.trim() !== '';
  const step2Valid = staged.length > 0;
  const step3Valid = grievance.trim().length > 2;
  const canSubmit = consent && !submitting;

  const toggleRecording = useCallback(() => {
    const SpeechRec =
      typeof window !== 'undefined'
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;
    if (!SpeechRec) {
      alert('Speech recognition is not supported in this browser. Try Chrome or Edge.');
      return;
    }
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
      return;
    }
    const rec = new SpeechRec();
    rec.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setGrievance((prev) => {
        const base = prev.trimEnd();
        return base ? base + ' ' + transcript : transcript;
      });
    };
    rec.onerror = () => setIsRecording(false);
    rec.onend = () => setIsRecording(false);
    recognitionRef.current = rec;
    rec.start();
    setIsRecording(true);
  }, [isRecording, language]);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      // Silently obtain a citizen token if not already authenticated.
      // This means the citizen never needs to visit /login — they just fill
      // the form and submit. The shared 'citizen' account is used for demo.
      if (!citizenAuth.token()) {
        setProgress('Authenticating…');
        const BASE_URL =
          (process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api/v1').replace(/\/$/, '');
        const form = new URLSearchParams();
        form.set('username', 'citizen');
        form.set('password', 'password123');
        const res = await fetch(`${BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: form.toString(),
        });
        if (res.ok) {
          const data = await res.json() as { access_token: string };
          citizenAuth.save(data.access_token);
        }
      }

      setProgress('Creating your case…');
      const created: CaseSummary = await citizenCaseApi.create({
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
          // Backend requires doc_type; OCR pipeline will refine it later
          docType: 'income_cert',
          filename: item.isPdf ? `document_${i + 1}.pdf` : `document_${i + 1}.jpg`,
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
    <div className="animate-slide-up max-w-2xl mx-auto">
      {/* Hero */}
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold text-surface-900 sm:text-4xl">
          Get legal help
        </h1>
        <p className="mt-3 max-w-prose text-base text-surface-500 leading-relaxed">
          Answer a few questions and take photos of your documents. A legal aid worker
          reviews every request before any result is shared.
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-0 mb-8">
        {[
          { n: 1, label: 'Situation' },
          { n: 2, label: 'Documents' },
          { n: 3, label: 'Grievance' },
          { n: 4, label: 'Consent' },
        ].map(({ n, label }, idx, arr) => (
          <div key={n} className="flex items-center flex-1">
            <button
              type="button"
              onClick={() => step > n && setStep(n)}
              className={`flex flex-col items-center gap-1 min-w-[56px] focus:outline-none ${
                step > n ? 'cursor-pointer' : 'cursor-default'
              }`}
              aria-label={`Step ${n}: ${label}`}
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-all duration-300 ${
                  step === n
                    ? 'bg-brand-600 text-white shadow-glow scale-110'
                    : step > n
                      ? 'bg-emerald-500 text-white'
                      : 'bg-surface-100 text-surface-400'
                }`}
              >
                {step > n ? '✓' : n}
              </span>
              <span
                className={`text-[11px] font-medium hidden sm:block ${
                  step === n ? 'text-brand-600' : 'text-surface-400'
                }`}
              >
                {label}
              </span>
            </button>
            {idx < arr.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-1 transition-colors duration-500 ${
                  step > n ? 'bg-emerald-400' : 'bg-surface-200'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* ---- STEP 1: Situation ---- */}
      {step === 1 && (
        <section className="card-flat space-y-5 animate-slide-up">
          <StepHeader n={1} icon="📍" title="About your situation" />

          <Field label="District" required>
            <input
              id="district"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              placeholder="e.g. Vellore"
              className="input-field"
              autoFocus
              aria-required="true"
            />
          </Field>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Monthly household income (₹)">
              <input
                id="monthly-income"
                inputMode="numeric"
                value={monthlyIncome}
                onChange={(e) => setMonthlyIncome(e.target.value)}
                placeholder="e.g. 8000"
                className="input-field"
              />
            </Field>

            <Field label="Preferred language">
              <select
                id="language"
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                className="input-field"
              >
                <option value="en">English</option>
                <option value="hi">हिन्दी</option>
              </select>
            </Field>
          </div>

          <Field label="Describe what happened">
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Include dates and anything urgent, such as a deadline on a notice."
              className="input-field resize-none"
            />
          </Field>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!step1Valid}
              className="btn-primary"
            >
              Next — Add Documents →
            </button>
          </div>
        </section>
      )}

      {/* ---- STEP 2: Documents ---- */}
      {step === 2 && (
        <section className="card-flat space-y-5 animate-slide-up">
          <StepHeader n={2} icon="📷" title="Take pictures of your documents" />

          <p className="text-sm text-surface-500 leading-relaxed -mt-1">
            Take a clear photo of each document — income certificates, eviction notices,
            Aadhaar, wage slips, or any other paperwork. Our system will{' '}
            <strong>automatically identify</strong> what each document is.
          </p>

          <CameraCapture
            disabled={submitting}
            onCapture={(file, previewUrl) =>
              setStaged((prev) => [
                ...prev,
                { file, previewUrl, isPdf: file.type === 'application/pdf' },
              ])
            }
          />

          {staged.length > 0 && (
            <>
              <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
                {staged.length} document{staged.length > 1 ? 's' : ''} added
              </p>
              <ul
                className="grid grid-cols-2 gap-4 sm:grid-cols-3"
                aria-label="Document previews"
              >
                {staged.map((item, i) => (
                  <li
                    key={item.previewUrl}
                    className="group relative overflow-hidden rounded-xl border border-surface-200 bg-surface-50 animate-slide-up"
                  >
                    {item.isPdf ? (
                      <div className="h-36 w-full flex flex-col items-center justify-center bg-red-50 text-red-500">
                        <span className="text-4xl">📄</span>
                        <span className="text-xs font-medium mt-1">PDF Document</span>
                      </div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.previewUrl}
                        alt={`Document ${i + 1} preview`}
                        className="h-36 w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    )}
                    <div className="flex items-center justify-between px-3 py-2 text-xs bg-white">
                      <span className="font-medium text-surface-600">
                        Document {i + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setStaged((prev) => prev.filter((_, idx) => idx !== i))
                        }
                        className="text-danger font-medium hover:underline"
                        aria-label={`Remove document ${i + 1}`}
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="btn-secondary"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              disabled={!step2Valid}
              className="btn-primary"
            >
              Next — Your Problem →
            </button>
          </div>
        </section>
      )}

      {/* ---- STEP 3: Grievance ---- */}
      {step === 3 && (
        <section className="card-flat space-y-5 animate-slide-up">
          <StepHeader n={3} icon="⚖️" title="Describe your problem" />

          <p className="text-sm text-surface-500 leading-relaxed -mt-1">
            In your own words, describe what happened and what help you need.
            You can type in <strong>any language</strong> or use the
            microphone to speak.
          </p>

          {/* Text area + mic button */}
          <div className="relative">
            <textarea
              id="grievance-text"
              value={grievance}
              onChange={(e) => setGrievance(e.target.value)}
              rows={6}
              placeholder={
                language === 'hi'
                  ? 'यहाँ अपनी समस्या लिखें या माइक बटन दबाकर बोलें…'
                  : 'Type what happened here, or press the mic button to speak…'
              }
              className={`input-field resize-none pr-14 transition-all duration-200 ${
                isRecording ? 'border-red-400 ring-2 ring-red-200' : ''
              }`}
              aria-label="Describe your grievance"
            />
            {/* Mic button — pinned inside the textarea bottom-right */}
            <button
              type="button"
              onClick={toggleRecording}
              title={isRecording ? 'Stop recording' : 'Start voice input'}
              aria-label={isRecording ? 'Stop voice recording' : 'Start voice recording'}
              className={`absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full border-2 text-lg transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                isRecording
                  ? 'border-red-400 bg-red-500 text-white animate-pulse shadow-lg'
                  : 'border-surface-300 bg-white text-surface-600 hover:border-brand-400 hover:bg-brand-50'
              }`}
            >
              🎙️
            </button>
          </div>

          {isRecording && (
            <p className="flex items-center gap-2 text-sm text-red-600 font-medium animate-pulse">
              <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />
              Listening… Speak now. Tap the mic again to stop.
            </p>
          )}

          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => {
                if (isRecording && recognitionRef.current) {
                  recognitionRef.current.stop();
                  setIsRecording(false);
                }
                setStep(2);
              }}
              className="btn-secondary"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={() => setStep(4)}
              disabled={!step3Valid}
              className="btn-primary"
            >
              Next — Confirm & Send →
            </button>
          </div>
        </section>
      )}

      {/* ---- STEP 4: Consent & Submit ---- */}
      {step === 4 && (
        <section className="card-flat space-y-6 animate-slide-up">
          <StepHeader n={4} icon="🔒" title="Review & give consent" />

          {/* Summary */}
          <div className="rounded-xl bg-surface-50 border border-surface-200 divide-y divide-surface-100 text-sm">
            <SummaryRow label="District" value={district} />
            <SummaryRow label="Documents" value={`${staged.length} added`} />
            <SummaryRow label="Help needed" value={grievance} />
            {monthlyIncome && <SummaryRow label="Monthly income" value={`₹ ${monthlyIncome}`} />}
          </div>

          {/* Consent checkbox */}
          <label
            htmlFor="consent-checkbox"
            className="flex items-start gap-4 cursor-pointer rounded-xl border-2 border-surface-200 bg-surface-50 p-5 transition-all duration-200 hover:bg-brand-50 hover:border-brand-300"
          >
            <input
              id="consent-checkbox"
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-5 w-5 rounded border-surface-300 text-brand-600 focus:ring-brand-500 shrink-0"
            />
            <span className="text-sm text-surface-700 leading-relaxed">
              I agree that{' '}
              <strong className="text-surface-900">NyayaSetu</strong> may store and
              process these documents to check which legal aid schemes apply to me,
              under the{' '}
              <strong className="text-surface-900">
                Digital Personal Data Protection Act, 2023
              </strong>
              . This is{' '}
              <em>not legal advice</em> — a trained legal aid worker reviews every
              request.
            </span>
          </label>

          {/* Not legal advice notice */}
          <p className="text-xs text-surface-400 text-center leading-relaxed px-4">
            🔐 Your data is encrypted and never shared with third parties without your
            permission.
          </p>

          {error && (
            <div
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 animate-slide-up"
              role="alert"
            >
              {error}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-2">
            <button
              type="button"
              onClick={() => setStep(3)}
              className="btn-secondary w-full sm:w-auto"
              disabled={submitting}
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className="btn-primary w-full sm:w-auto"
            >
              {submitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  {progress ?? 'Sending…'}
                </>
              ) : (
                '🚀 Send for review'
              )}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

/* ---------- Sub-components ---------- */

function StepHeader({
  n,
  icon,
  title,
}: {
  n: number;
  icon: string;
  title: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-100 text-brand-600 text-base"
        aria-hidden="true"
      >
        {icon}
      </span>
      <div>
        <p className="text-xs font-medium text-surface-400 uppercase tracking-wider">
          Step {n} of 4
        </p>
        <h2 className="font-heading text-lg font-bold text-surface-900 leading-tight">
          {title}
        </h2>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <span className="block text-sm font-medium text-surface-700">
        {label}
        {required && (
          <span className="ml-1 text-danger text-xs" aria-label="required">
            *
          </span>
        )}
      </span>
      {children}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-surface-500 font-medium">{label}</span>
      <span className="text-surface-900 font-semibold text-right max-w-[60%]">
        {value}
      </span>
    </div>
  );
}
