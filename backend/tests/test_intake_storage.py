import uuid
from pathlib import Path

from app.intake.storage import LocalDocumentStorage


def test_local_document_storage_round_trips_bytes(tmp_path: Path) -> None:
    storage = LocalDocumentStorage(tmp_path)
    case_id = uuid.uuid4()
    key = storage.save(case_id=case_id, filename="notice.pdf", content=b"%PDF-1.7\nbody")

    assert key.startswith(f"cases/{case_id}/")
    assert storage.load(storage_key=key) == b"%PDF-1.7\nbody"
