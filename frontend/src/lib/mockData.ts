import type {
  AuditEvent,
  CaseDetail,
  QueueItem,
  SchemeMatch,
} from "@/types/api";

export const mockQueueItems: QueueItem[] = [
  {
    case_id: "case_1001",
    urgency_tier: "CRITICAL",
    urgency_score: 95,
    status: "TRIAGED",
    sla_seconds_remaining: 2700, // 45 mins
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    district: "Vellore",
    document_count: 2,
  },
  {
    case_id: "case_1002",
    urgency_tier: "HIGH",
    urgency_score: 80,
    status: "TRIAGED",
    sla_seconds_remaining: 14400, // 4 hours
    created_at: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    district: "Chennai",
    document_count: 1,
  },
];

export const mockCaseDetailByCaseId: Record<string, CaseDetail> = {
  case_1003: {
    id: "case_1003",
    urgency_tier: "STANDARD",
    urgency_score: 25,
    status: "IN_REVIEW",
    gated: false,
    gate_notice: null,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    updated_at: new Date().toISOString(),
    district: "Vellore",
    language: "en",
    citizen_id: "cit_1",
    created_by_operator_id: null,
    triage_signals: [],
    triage_reasoning: null,
    documents: [
      {
        id: "doc_1",
        case_id: "case_1003",
        doc_type: "income_cert",
        ocr_status: "DONE",
        ocr_engine: "mock",
        ocr_confidence: 0.95,
        uploaded_at: new Date().toISOString(),
        preview_url: "/mock/sample-document.png",
        extracted_fields: [
          { id: 'f1', document_id: 'doc_1', field_name: "Full Name", field_value: "Anita Sharma", confidence: 0.97, is_operator_corrected: false, corrected_by_operator_id: null },
          { id: 'f2', document_id: 'doc_1', field_name: "Annual Income", field_value: "₹1,42,000", confidence: 0.61, is_operator_corrected: false, corrected_by_operator_id: null },
        ]
      }
    ],
    matches: []
  },
};

export const mockMatchesByCaseId: Record<string, SchemeMatch[]> = {
  case_1003: [
    {
      id: "match_1",
      case_id: "case_1003",
      scheme_name: "State Victim Compensation Scheme",
      act_name: "State Victim Compensation Scheme, 2011",
      section_number: "Section 4(2)",
      clause_text:
        "Any victim whose annual family income does not exceed the notified threshold shall be eligible for compensation under this scheme, subject to verification by the District Legal Services Authority.",
      semantic_score: 0.88,
      rule_eligibility_pass: true,
      final_confidence: 0.91,
      operator_decision: 'pending',
      decision_reason: null,
      decided_at: null,
    },
  ],
};

export const mockAuditTrailByCaseId: Record<string, AuditEvent[]> = {
  case_1003: [
    {
      id: 1,
      case_id: "case_1003",
      event_type: "OCR_PARSE",
      actor_type: "SYSTEM",
      actor_id: null,
      payload: { summary: "Aadhaar document uploaded and queued for extraction." },
      event_hash: "a3f9c1d8e0f2b4a7c9d1e3f5a7b9c1d3e5f7a9b1c3d5e7f9a1b3c5d7e9f21c",
      previous_hash: null,
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    },
  ],
};
