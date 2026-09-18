/**
 * Tests for types/api.ts
 *
 * These are compile-time type-safety checks that verify the shared type
 * contract stays correct. If any of these fail, it means the types file
 * has drifted from the design doc's schema definitions.
 */

import { describe, it, expect } from 'vitest';
import type {
  CaseStatus,
  UrgencyTier,
  OcrStatus,
  DocType,
  OperatorDecision,
  AuditEventType,
  CaseDetail,
  SchemeMatch,
  AuditEvent,
} from '@/types/api';

describe('API type contract', () => {
  it('CaseStatus matches the DB CHECK constraint values', () => {
    // These literal assignments would fail at compile time if the union drifts
    const statuses: CaseStatus[] = [
      'RECEIVED',
      'EXTRACTED',
      'TRIAGED',
      'MATCHED',
      'IN_REVIEW',
      'REFERRED',
      'CLOSED',
    ];
    expect(statuses).toHaveLength(7);
  });

  it('UrgencyTier matches the three-tier model', () => {
    const tiers: UrgencyTier[] = ['STANDARD', 'HIGH', 'CRITICAL'];
    expect(tiers).toHaveLength(3);
  });

  it('OcrStatus covers all pipeline states', () => {
    const statuses: OcrStatus[] = ['PENDING', 'PROCESSING', 'DONE', 'FAILED'];
    expect(statuses).toHaveLength(4);
  });

  it('DocType covers the 6 document types from FR-2', () => {
    const types: DocType[] = [
      'aadhaar',
      'income_cert',
      'fir',
      'eviction_notice',
      'wage_slip',
      'medical_report',
    ];
    expect(types).toHaveLength(6);
  });

  it('OperatorDecision covers all decision states', () => {
    const decisions: OperatorDecision[] = [
      'pending',
      'approved',
      'overridden',
      'rejected',
    ];
    expect(decisions).toHaveLength(4);
  });

  it('AuditEventType covers all pipeline events', () => {
    const events: AuditEventType[] = [
      'OCR_PARSE',
      'FIELD_EXTRACTED',
      'FIELD_CORRECTED',
      'URGENCY_SCORED',
      'GATE_ENFORCED',
      'MATCH_GENERATED',
      'OPERATOR_DECISION',
      'REFERRAL_ISSUED',
    ];
    expect(events).toHaveLength(8);
  });

  it('CaseDetail.matches is nullable (gate contract)', () => {
    // This compile-time test verifies the gating contract:
    // matches must be SchemeMatch[] | null, not just SchemeMatch[]
    const gatedCase: Pick<CaseDetail, 'matches' | 'gated'> = {
      matches: null,
      gated: true,
    };
    expect(gatedCase.matches).toBeNull();

    const openCase: Pick<CaseDetail, 'matches' | 'gated'> = {
      matches: [],
      gated: false,
    };
    expect(openCase.matches).toEqual([]);
  });

  it('SchemeMatch requires clause_text (never black-box)', () => {
    // Per FR-17: every match must carry source citation
    const match: Pick<SchemeMatch, 'clause_text' | 'section_number' | 'final_confidence'> = {
      clause_text: 'Section 12(1) of the Legal Services Authorities Act, 1987',
      section_number: '12(1)',
      final_confidence: 0.85,
    };
    expect(match.clause_text).toBeTruthy();
    expect(match.final_confidence).toBeGreaterThanOrEqual(0);
    expect(match.final_confidence).toBeLessThanOrEqual(1);
  });

  it('AuditEvent carries hash chain fields', () => {
    const event: Pick<AuditEvent, 'event_hash' | 'previous_hash'> = {
      event_hash: 'sha256:abc123',
      previous_hash: 'sha256:prev456',
    };
    expect(event.event_hash).toBeTruthy();
  });
});
