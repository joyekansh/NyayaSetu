import sys
import uuid
from datetime import datetime
import json
from sqlalchemy.orm import Session
from app.db import SessionLocal
from app.models.user import User, UserRole
from app.models.case_record import CaseRecord
from app.models.case import CaseStatus, UrgencyTier
from app.models.document import Document, DocumentType, OcrStatus
from app.models.scheme_match import SchemeMatch, MatchStatus

def seed():
    db = SessionLocal()
    try:
        # Get or create a citizen user
        citizen = db.query(User).filter_by(role=UserRole.CITIZEN).first()
        if not citizen:
            citizen = User(
                email="citizen_demo@nyayasetu.org",
                display_name="Demo Citizen",
                role=UserRole.CITIZEN
            )
            db.add(citizen)
            db.commit()
            db.refresh(citizen)
        
        # Get operator user
        operator = db.query(User).filter_by(role=UserRole.CASEWORKER).first()
        operator_id = str(operator.id) if operator else str(uuid.uuid4())

        # Create case
        demo_case = CaseRecord(
            status=CaseStatus.IN_REVIEW,
            urgency_tier=UrgencyTier.CRITICAL,
            urgency_score=95.0,
            language="en",
            intake_answers={"district": "South Delhi"},
            gate_release_operator=operator_id,
            gate_release_reason="Released for demo purposes"
        )
        db.add(demo_case)
        db.commit()
        db.refresh(demo_case)
        print(f"Created Case: {demo_case.id}")

        # Create document
        doc = Document(
            case_id=demo_case.id,
            uploaded_by_user_id=citizen.id,
            document_type=DocumentType.EVICTION_NOTICE,
            ocr_status=OcrStatus.COMPLETED,
            storage_key="demo_eviction_notice.pdf",
            checksum="0"*64,
            content_type="application/pdf"
        )
        db.add(doc)
        db.commit()

        # Create match
        match1 = SchemeMatch(
            case_id=demo_case.id,
            scheme_id="NALSA Free Legal Aid",
            clause_id="Section 12(e) - Persons facing sudden eviction or natural disaster",
            confidence_score=0.92,
            status=MatchStatus.PENDING
        )
        match2 = SchemeMatch(
            case_id=demo_case.id,
            scheme_id="State Victim Compensation Scheme",
            clause_id="Clause 4(a) - Immediate relief for housing displacement",
            confidence_score=0.78,
            status=MatchStatus.PENDING
        )
        db.add_all([match1, match2])
        db.commit()
        
        print("Demo case seeded successfully.")
    except Exception as e:
        print(f"Error seeding: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
