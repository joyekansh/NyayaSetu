/**
 * Tests for lib/citizenCaseApi.ts
 *
 * Covers: OTP auth flow, case creation, case retrieval,
 * and field correction.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { citizenAuthApi, citizenCaseApi } from '@/lib/citizenCaseApi';
import { citizenAuth } from '@/lib/httpClient';
import type { CaseDetail, CaseSummary } from '@/types/api';

// Mock the httpClient module so we can control request() responses
vi.mock('@/lib/httpClient', async () => {
  const actual = await vi.importActual<typeof import('@/lib/httpClient')>(
    '@/lib/httpClient',
  );
  return {
    ...actual,
    request: vi.fn(),
    citizenAuth: {
      token: vi.fn(() => null),
      save: vi.fn(),
      clear: vi.fn(),
    },
  };
});

// Get a reference to the mocked request
import { request } from '@/lib/httpClient';
const mockRequest = vi.mocked(request);

describe('citizenAuthApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('requestOtp', () => {
    it('sends phone number to /auth/otp/request', async () => {
      const response = { sent: true, expires_in: 300 };
      mockRequest.mockResolvedValueOnce(response);

      const result = await citizenAuthApi.requestOtp('+919876543210');

      expect(mockRequest).toHaveBeenCalledWith('/auth/otp/request', {
        method: 'POST',
        body: { phone: '+919876543210' },
        authenticated: false,
      });
      expect(result).toEqual(response);
    });
  });

  describe('verifyOtp', () => {
    it('sends phone + otp and saves the returned token', async () => {
      const response = { access_token: 'jwt-token-123' };
      mockRequest.mockResolvedValueOnce(response);

      const result = await citizenAuthApi.verifyOtp('+919876543210', '1234');

      expect(mockRequest).toHaveBeenCalledWith('/auth/otp/verify', {
        method: 'POST',
        body: { phone: '+919876543210', otp: '1234' },
        authenticated: false,
      });
      expect(citizenAuth.save).toHaveBeenCalledWith('jwt-token-123');
      expect(result).toEqual(response);
    });
  });
});

describe('citizenCaseApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('POSTs a new case with intake answers and consent', async () => {
      const payload = {
        assisted_mode: false,
        district: 'Vellore',
        language: 'en' as const,
        intake_answers: {
          grievance_type: 'Eviction or housing',
          description: 'Received eviction notice',
          declared_monthly_income: '8000',
        },
        consent_given: true,
      };
      const created: CaseSummary = {
        id: 'case-uuid',
        status: 'RECEIVED',
        urgency_tier: null,
        urgency_score: null,
        district: 'Vellore',
        language: 'en',
        created_at: '2026-09-18T10:00:00Z',
        updated_at: '2026-09-18T10:00:00Z',
      };
      mockRequest.mockResolvedValueOnce(created);

      const result = await citizenCaseApi.create(payload);

      expect(mockRequest).toHaveBeenCalledWith('/cases', {
        method: 'POST',
        body: payload,
      });
      expect(result.id).toBe('case-uuid');
      expect(result.status).toBe('RECEIVED');
    });
  });

  describe('get', () => {
    it('fetches case detail by ID', async () => {
      const detail: CaseDetail = {
        id: 'case-uuid',
        citizen_id: 'citizen-1',
        created_by_operator_id: null,
        status: 'MATCHED',
        urgency_tier: 'STANDARD',
        urgency_score: 12,
        district: 'Vellore',
        language: 'en',
        created_at: '2026-09-18T10:00:00Z',
        updated_at: '2026-09-18T10:01:00Z',
        documents: [],
        matches: [],
        gated: false,
        gate_notice: null,
        triage_signals: [],
        triage_reasoning: null,
      };
      mockRequest.mockResolvedValueOnce(detail);

      const result = await citizenCaseApi.get('case-uuid');

      expect(mockRequest).toHaveBeenCalledWith('/cases/case-uuid', {});
      expect(result.gated).toBe(false);
      expect(result.matches).toEqual([]);
    });

    it('returns gated case with null matches for CRITICAL tier', async () => {
      const gatedDetail: CaseDetail = {
        id: 'case-critical',
        citizen_id: 'citizen-2',
        created_by_operator_id: null,
        status: 'TRIAGED',
        urgency_tier: 'CRITICAL',
        urgency_score: 45,
        district: 'Delhi',
        language: 'hi',
        created_at: '2026-09-18T10:00:00Z',
        updated_at: '2026-09-18T10:01:00Z',
        documents: [],
        matches: null,
        gated: true,
        gate_notice: 'Your case has been prioritized for human review.',
        triage_signals: [
          {
            check_name: 'physical_violence',
            triggered: true,
            weight: 40,
            evidence: 'Keywords detected in description',
          },
        ],
        triage_reasoning: null,
      };
      mockRequest.mockResolvedValueOnce(gatedDetail);

      const result = await citizenCaseApi.get('case-critical');

      expect(result.gated).toBe(true);
      expect(result.matches).toBeNull();
      expect(result.gate_notice).toBeTruthy();
    });
  });

  describe('correctField', () => {
    it('PATCHes a field correction', async () => {
      mockRequest.mockResolvedValueOnce(undefined);

      await citizenCaseApi.correctField('case-uuid', {
        field_id: 'field-1',
        field_value: '₹8,000',
      });

      expect(mockRequest).toHaveBeenCalledWith('/cases/case-uuid/fields', {
        method: 'PATCH',
        body: { field_id: 'field-1', field_value: '₹8,000' },
      });
    });
  });
});
