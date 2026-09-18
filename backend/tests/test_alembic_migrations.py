import os
import subprocess
import sys
from pathlib import Path

from sqlalchemy import create_engine, inspect


BACKEND_DIR = Path(__file__).resolve().parents[1]


def _run_alembic(database_url: str, *arguments: str) -> subprocess.CompletedProcess[str]:
    environment = os.environ | {"DATABASE_URL": database_url}
    return subprocess.run(
        [sys.executable, "-m", "alembic", "-c", "alembic.ini", *arguments],
        cwd=BACKEND_DIR,
        env=environment,
        check=False,
        capture_output=True,
        text=True,
    )


def test_baseline_migration_matches_current_model_metadata(tmp_path: Path) -> None:
    """Fails if the migration omits an existing model table or creates a non-model table."""
    from app.models.audit_event import AuditEvent  # noqa: F401
    from app.models.base import Base
    from app.models.case_record import CaseRecord  # noqa: F401
    from app.models.document import Document  # noqa: F401
    from app.models.extracted_field import ExtractedField  # noqa: F401
    from app.models.user import User  # noqa: F401

    database_url = f"sqlite:///{tmp_path / 'migrations.db'}"
    upgrade = _run_alembic(database_url, "upgrade", "head")

    assert upgrade.returncode == 0, upgrade.stderr
    assert set(inspect(create_engine(database_url)).get_table_names()) == set(Base.metadata.tables) | {"alembic_version"}


def test_baseline_migration_downgrade_removes_model_tables(tmp_path: Path) -> None:
    """Fails if the baseline downgrade leaves application schema behind."""
    database_url = f"sqlite:///{tmp_path / 'downgrade.db'}"

    assert _run_alembic(database_url, "upgrade", "head").returncode == 0
    downgrade = _run_alembic(database_url, "downgrade", "base")

    assert downgrade.returncode == 0, downgrade.stderr
    assert inspect(create_engine(database_url)).get_table_names() == ["alembic_version"]
