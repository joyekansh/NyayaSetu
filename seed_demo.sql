INSERT INTO users (id, email, display_name, role) VALUES (gen_random_uuid(), 'citizen_demo@nyayasetu.org', 'Demo Citizen', 'CITIZEN') ON CONFLICT DO NOTHING;

INSERT INTO cases (id, status, urgency_tier, urgency_score, language, intake_answers, gate_release_operator, gate_release_reason, created_at, updated_at) 
VALUES ('c0000000-0000-0000-0000-000000000001', 'IN_REVIEW', 'CRITICAL', 95.0, 'en', '{"district": "South Delhi"}', (SELECT id FROM users WHERE role='CASEWORKER' LIMIT 1), 'Released for demo purposes', NOW(), NOW());

INSERT INTO documents (id, case_id, uploaded_by_user_id, document_type, ocr_status, storage_key, checksum, content_type, created_at)
VALUES ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', (SELECT id FROM users WHERE role='CITIZEN' LIMIT 1), 'EVICTION_NOTICE', 'COMPLETED', 'demo_eviction_notice.pdf', '0000000000000000000000000000000000000000000000000000000000000000', 'application/pdf', NOW());

INSERT INTO scheme_matches (id, case_id, scheme_id, clause_id, confidence_score, status, operator_reason, created_at)
VALUES 
('m0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'NALSA Free Legal Aid', 'Section 12(e) - Persons facing sudden eviction or natural disaster', 0.92, 'PENDING', NULL, NOW()),
('m0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'State Victim Compensation Scheme', 'Clause 4(a) - Immediate relief for housing displacement', 0.78, 'PENDING', NULL, NOW());
