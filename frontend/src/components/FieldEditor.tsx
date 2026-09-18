'use client';

/**
 * components/FieldEditor.tsx — FR-12: shows every OCR-extracted field with its
 * confidence and lets an operator correct it (PATCH /cases/{id}/fields).
 * OWNER: Akash.
 *
 * Design intent: low-confidence fields are the point of this screen, so they sort
 * to the top and are visually loud. A corrected field keeps a permanent marker —
 * the audit ledger records the change and the UI should not hide it.
 */

import { useMemo, useState } from 'react';
import { citizenCaseApi } from '@/lib/citizenCaseApi';
import { HttpError } from '@/lib/httpClient';
import type { ExtractedField } from '@/types/api';

const LOW_CONFIDENCE = 0.75;

export interface FieldEditorProps {
  caseId: string;
  fields: ExtractedField[];
  /** Read-only once a referral locks the case. */
  locked?: boolean;
  onFieldSaved?: (field: ExtractedField) => void;
}

export default function FieldEditor({
  caseId,
  fields,
  locked = false,
  onFieldSaved,
}: FieldEditorProps) {
  const ordered = useMemo(
    () =>
      [...fields].sort(
        (a, b) => (a.confidence ?? 0) - (b.confidence ?? 0),
      ),
    [fields],
  );

  if (ordered.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-600">
        No fields extracted yet. They appear here as the document finishes processing.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-slate-200 rounded-md border border-slate-200">
      {ordered.map((field) => (
        <FieldRow
          key={field.id}
          caseId={caseId}
          field={field}
          locked={locked}
          onSaved={onFieldSaved}
        />
      ))}
    </ul>
  );
}

function FieldRow({
  caseId,
  field,
  locked,
  onSaved,
}: {
  caseId: string;
  field: ExtractedField;
  locked: boolean;
  onSaved?: (field: ExtractedField) => void;
}) {
  const [value, setValue] = useState(field.field_value ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(field.is_operator_corrected);
  const [error, setError] = useState<string | null>(null);

  const dirty = value !== (field.field_value ?? '');
  const confidence = field.confidence ?? 0;
  const needsAttention = confidence < LOW_CONFIDENCE;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await citizenCaseApi.correctField(caseId, { field_id: field.id, field_value: value });
      setSaved(true);
      onSaved?.({
        ...field,
        field_value: value,
        is_operator_corrected: true,
      });
    } catch (err) {
      setError(
        err instanceof HttpError
          ? err.message
          : 'The correction did not save. Try again.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="sm:w-48 sm:shrink-0">
        <label
          htmlFor={`field-${field.id}`}
          className="block text-sm font-medium text-slate-900"
        >
          {humanise(field.field_name)}
        </label>
        <ConfidenceTag confidence={confidence} corrected={saved} />
      </div>

      <div className="flex flex-1 items-center gap-2">
        <input
          id={`field-${field.id}`}
          value={value}
          disabled={locked || saving}
          onChange={(e) => setValue(e.target.value)}
          className={[
            'w-full rounded-md border px-3 py-2 text-sm',
            needsAttention && !saved
              ? 'border-amber-500 bg-amber-50'
              : 'border-slate-300',
            locked ? 'bg-slate-100 text-slate-600' : '',
          ].join(' ')}
        />
        {!locked && (
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="shrink-0 rounded-md bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700 sm:w-full">
          {error}
        </p>
      )}
    </li>
  );
}

function ConfidenceTag({
  confidence,
  corrected,
}: {
  confidence: number;
  corrected: boolean;
}) {
  if (corrected) {
    return (
      <span className="text-xs text-slate-600">Corrected by operator</span>
    );
  }
  const pct = Math.round(confidence * 100);
  const tone =
    confidence >= 0.9
      ? 'text-emerald-700'
      : confidence >= LOW_CONFIDENCE
        ? 'text-slate-600'
        : 'text-amber-700';
  return (
    <span className={`text-xs ${tone}`}>
      {pct}% confidence{confidence < LOW_CONFIDENCE ? ' — check this' : ''}
    </span>
  );
}

function humanise(fieldName: string): string {
  const s = fieldName.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
