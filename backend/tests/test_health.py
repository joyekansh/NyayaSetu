from fastapi.testclient import TestClient


def test_health_reports_service_status() -> None:
    from app.main import create_app

    response = TestClient(create_app()).get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
