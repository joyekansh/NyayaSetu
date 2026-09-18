/**
 * lib/mockData.ts
 *
 * Stub responses standing in for Riya's endpoints. Enable with
 * NEXT_PUBLIC_USE_MOCKS=true in .env.local. Swap this out for real
 * responses the moment /queue and /cases/{id} are live — do not build
 * new UI behavior against these shapes without confirming them against
 * the real backend first (see integration checkpoint in the brief).
 */

import type {
  AuditTrailResponse,
  CaseDetail,
  MatchesResponse,
  QueueResponse,
} from "@/types/api";

export const mockQueueResponse: QueueResponse = {
  items: [
    {
      case_id: "case_1001",
      citizen_display_name: "R. Kumar",
      urgency_tier: "CRITICAL",
      status: "TRIAGED",
      sla_deadline: new Date(Date.now() + 1000 * 60 * 45).toISOString(),
      created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      is_gated: true,
    },
    {
      case_id: "case_1002",
      citizen_display_name: "S. Devi",
      urgency_tier: "HIGH",
      status: "TRIAGED",
      sla_deadline: new Date(Date.now() + 1000 * 60 * 60 * 4).toISOString(),
      created_at: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
      is_gated: true,
    },
    {
      case_id: "case_1003",
      citizen_display_name: "A. Sharma",
      urgency_tier: "STANDARD",
      status: "IN_REVIEW",
      sla_deadline: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
      is_gated: false,
    },
  ],
};

export const mockCaseDetailByCaseId: Record<string, CaseDetail> = {
  case_1003: {
    case_id: "case_1003",
    citizen_display_name: "A. Sharma",
    urgency_tier: "STANDARD",
    status: "IN_REVIEW",
    is_gated: false,
    document_image_url: "/mock/sample-document.png",
    extracted_fields: [
      { field_name: "Full Name", value: "Anita Sharma", confidence: 0.97, is_low_confidence: false },
      { field_name: "Aadhaar Number", value: "XXXX XXXX 4821", confidence: 0.94, is_low_confidence: false },
      { field_name: "Annual Income", value: "₹1,42,000", confidence: 0.61, is_low_confidence: true },
      { field_name: "District", value: "Vellore", confidence: 0.88, is_low_confidence: false },
    ],
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    locked: false,
  },
  case_1001: {
    case_id: "case_1001",
    citizen_display_name: "R. Kumar",
    urgency_tier: "CRITICAL",
    status: "TRIAGED",
    is_gated: true,
    document_image_url: "/mock/sample-document.png",
    extracted_fields: [
      { field_name: "Full Name", value: "Ravi Kumar", confidence: 0.95, is_low_confidence: false },
      { field_name: "Incident Type", value: "Domestic Violence", confidence: 0.9, is_low_confidence: false },
    ],
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    locked: false,
  },
};

export const mockMatchesByCaseId: Record<string, MatchesResponse> = {
  case_1003: {
    case_id: "case_1003",
    matches: [
      {
        match_id: "match_1",
        scheme_name: "State Victim Compensation Scheme",
        act_name: "State Victim Compensation Scheme, 2011",
        section_number: "Section 4(2)",
        clause_text:
          "Any victim whose annual family income does not exceed the notified threshold shall be eligible for compensation under this scheme, subject to verification by the District Legal Services Authority.",
        semantic_score: 0.88,
        rule_score: 0.95,
        final_confidence: 0.91,
        operator_decision: null,
        decision_reason: null,
      },
      {
        match_id: "match_2",
        scheme_name: "BOCW Welfare Fund",
        act_name: "Building and Other Construction Workers' Welfare Cess Act, 1996",
        section_number: "Section 22",
        clause_text:
          "A registered beneficiary shall be entitled to financial assistance for medical treatment upon submission of proof of registration and a certified medical estimate.",
        semantic_score: 0.71,
        rule_score: 0.58,
        final_confidence: 0.64,
        operator_decision: null,
        decision_reason: null,
      },
    ],
  },
};

export const mockAuditTrailByCaseId: Record<string, AuditTrailResponse> = {
  case_1003: {
    case_id: "case_1003",
    events: [
      {
        event_id: "evt_1",
        case_id: "case_1003",
        event_type: "DOCUMENT_UPLOADED",
        actor: "SYSTEM",
        summary: "Aadhaar document uploaded and queued for extraction.",
        event_hash: "a3f9c1d8e0f2b4a7c9d1e3f5a7b9c1d3e5f7a9b1c3d5e7f9a1b3c5d7e9f21c",
        previous_event_hash: null,
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
      },
      {
        event_id: "evt_2",
        case_id: "case_1003",
        event_type: "FIELDS_EXTRACTED",
        actor: "SYSTEM",
        summary: "OCR extraction completed with 4 fields identified.",
        event_hash: "b4a0d2e9f1a3c5b8d0e2f4a6b8c0d2e4f6a8b0c2d4e6f8a0b2c4d6e8f0a132d",
        previous_event_hash:
          "a3f9c1d8e0f2b4a7c9d1e3f5a7b9c1d3e5f7a9b1c3d5e7f9a1b3c5d7e9f21c",
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 3 + 1000 * 40).toISOString(),
      },
      {
        event_id: "evt_3",
        case_id: "case_1003",
        event_type: "MATCH_APPROVED",
        actor: "Paralegal — M. Iyer",
        summary: "Approved match: State Victim Compensation Scheme.",
        event_hash: "c5b1e3f0a2b4d6c9e1f3a5b7c9d1e3f5a7b9c1d3e5f7a9b1c3d5e7f9a1b243e",
        previous_event_hash:
          "b4a0d2e9f1a3c5b8d0e2f4a6b8c0d2e4f6a8b0c2d4e6f8a0b2c4d6e8f0a132d",
        created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      },
    ],
  },
};
