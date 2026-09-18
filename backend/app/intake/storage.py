import uuid
from pathlib import Path
from typing import Protocol


class DocumentStorage(Protocol):
    def save(self, *, case_id: uuid.UUID, filename: str, content: bytes) -> str:
        """Persist document bytes and return an opaque storage key."""

    def load(self, *, storage_key: str) -> bytes:
        """Load document bytes for a previously saved storage key."""


class LocalDocumentStorage:
    """Durable filesystem storage for demo/VM deployments."""

    def __init__(self, root: str | Path) -> None:
        self._root = Path(root)
        self._root.mkdir(parents=True, exist_ok=True)

    def save(self, *, case_id: uuid.UUID, filename: str, content: bytes) -> str:
        safe_name = Path(filename).name
        key = f"cases/{case_id}/{uuid.uuid4().hex}_{safe_name}"
        path = self._root / key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
        return key

    def load(self, *, storage_key: str) -> bytes:
        if ".." in Path(storage_key).parts:
            raise FileNotFoundError("invalid storage key")
        path = self._root / storage_key
        return path.read_bytes()
