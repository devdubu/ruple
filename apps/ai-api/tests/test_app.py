from fastapi.testclient import TestClient

from ruple_ai.main import app


def test_boots_without_gpu_model_database_or_peer_service():
    with TestClient(app) as client:
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok", "service": "ai-api"}


def test_skeleton_does_not_claim_inference_support():
    with TestClient(app) as client:
        assert client.post("/v1/chat/completions", json={}).status_code == 404
