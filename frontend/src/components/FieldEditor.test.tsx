/**
 * Tests for components/FieldEditor.tsx
 *
 * Covers: field rendering sorted by confidence, low-confidence visual markers,
 * inline correction flow, locked state, and error handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FieldEditor from '@/components/FieldEditor';
import type { ExtractedField } from '@/types/api';

// Mock citizenCaseApi so field save doesn't hit a real server
vi.mock('@/lib/citizenCaseApi', () => ({
  citizenCaseApi: {
    correctField: vi.fn(),
  },
}));

import { citizenCaseApi } from '@/lib/citizenCaseApi';
const mockCorrectField = vi.mocked(citizenCaseApi.correctField);

function makeField(overrides: Partial<ExtractedField> = {}): ExtractedField {
  return {
    id: 'f-1',
    document_id: 'doc-1',
    field_name: 'annual_income',
    field_value: '96000',
    confidence: 0.92,
    is_operator_corrected: false,
    corrected_by_operator_id: null,
    ...overrides,
  };
}

describe('FieldEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a placeholder message when fields are empty', () => {
    render(<FieldEditor caseId="case-1" fields={[]} />);

    expect(screen.getByText(/no fields extracted yet/i)).toBeInTheDocument();
  });

  it('renders fields with humanised labels', () => {
    const fields = [
      makeField({ field_name: 'annual_income' }),
      makeField({ id: 'f-2', field_name: 'date_of_birth', field_value: '1990-01-15', confidence: 0.95 }),
    ];

    render(<FieldEditor caseId="case-1" fields={fields} />);

    expect(screen.getByText('Annual income')).toBeInTheDocument();
    expect(screen.getByText('Date of birth')).toBeInTheDocument();
  });

  it('sorts fields by confidence ascending (lowest first)', () => {
    const fields = [
      makeField({ id: 'f-high', field_name: 'name', confidence: 0.99, field_value: 'Raj' }),
      makeField({ id: 'f-low', field_name: 'income', confidence: 0.5, field_value: '5000' }),
      makeField({ id: 'f-mid', field_name: 'district', confidence: 0.8, field_value: 'Delhi' }),
    ];

    render(<FieldEditor caseId="case-1" fields={fields} />);

    const inputs = screen.getAllByRole('textbox');
    // Lowest confidence (income=5000) should be first
    expect(inputs[0]).toHaveValue('5000');
    expect(inputs[1]).toHaveValue('Delhi');
    expect(inputs[2]).toHaveValue('Raj');
  });

  it('shows confidence percentage and warning for low-confidence fields', () => {
    const fields = [
      makeField({ confidence: 0.5 }),
    ];

    render(<FieldEditor caseId="case-1" fields={fields} />);

    expect(screen.getByText(/50% confidence/)).toBeInTheDocument();
    expect(screen.getByText(/check this/i)).toBeInTheDocument();
  });

  it('shows "Corrected by operator" for already-corrected fields', () => {
    const fields = [
      makeField({ is_operator_corrected: true }),
    ];

    render(<FieldEditor caseId="case-1" fields={fields} />);

    expect(screen.getByText(/corrected by operator/i)).toBeInTheDocument();
  });

  it('disables Save button when value has not changed', () => {
    const fields = [makeField()];
    render(<FieldEditor caseId="case-1" fields={fields} />);

    const saveBtn = screen.getByRole('button', { name: /save/i });
    expect(saveBtn).toBeDisabled();
  });

  it('enables Save button after editing a value', async () => {
    const user = userEvent.setup();
    const fields = [makeField({ field_value: '96000' })];

    render(<FieldEditor caseId="case-1" fields={fields} />);

    const input = screen.getByDisplayValue('96000');
    await user.clear(input);
    await user.type(input, '100000');

    const saveBtn = screen.getByRole('button', { name: /save/i });
    expect(saveBtn).toBeEnabled();
  });

  it('calls correctField API on save and notifies parent', async () => {
    const user = userEvent.setup();
    mockCorrectField.mockResolvedValueOnce(undefined);
    const onSaved = vi.fn();

    const fields = [makeField({ field_value: '96000' })];
    render(
      <FieldEditor caseId="case-1" fields={fields} onFieldSaved={onSaved} />,
    );

    const input = screen.getByDisplayValue('96000');
    await user.clear(input);
    await user.type(input, '100000');
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(mockCorrectField).toHaveBeenCalledWith('case-1', {
      field_id: 'f-1',
      field_value: '100000',
    });
    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({
        field_value: '100000',
        is_operator_corrected: true,
      }),
    );
  });

  it('disables inputs when locked', () => {
    const fields = [makeField()];
    render(<FieldEditor caseId="case-1" fields={fields} locked />);

    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
  });

  it('shows an error message when save fails', async () => {
    const user = userEvent.setup();
    mockCorrectField.mockRejectedValueOnce(new Error('Network error'));

    const fields = [makeField({ field_value: '96000' })];
    render(<FieldEditor caseId="case-1" fields={fields} />);

    const input = screen.getByDisplayValue('96000');
    await user.clear(input);
    await user.type(input, '50000');
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(
      await screen.findByText(/did not save/i),
    ).toBeInTheDocument();
  });
});
