import json
import logging
from pathlib import Path

import pytest
from fastapi import Request
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator

from ruple_ai.runtime import (
    ConfigurationError,
    Identity,
    ServerLogFormatter,
    StrictBody,
    create_app,
    load_config,
)

SCHEMA = json.loads((Path(__file__).resolve().parents[3] / "contracts/platform/http-v1.schema.json").read_text())
VALIDATOR = Draft202012Validator(SCHEMA)
DEVELOPMENT = {"APP_ENV": "test", "AUTH_MODE": "development", "DEV_USER_ID": "fixed-user"}


@pytest.mark.parametrize("env", [
    {"PORT": "0"}, {"PORT": "30.1"}, {"PORT": ""}, {"PORT": "65536"},
    {"APP_ENV": "invalid"}, {"NODE_ENV": "production", "APP_ENV": "development"},
    {"APP_ENV": "production", "AUTH_MODE": "development"},
    {"AUTH_MODE": "development", "HOST": "0.0.0.0"},
    {"APP_ENV": "production", "DOCS_ENABLED": "true"},
    {"DOCS_ENABLED": "yes"}, {"CORS_ORIGINS": "*"},
    {"AUTH_MODE": "development", "DEV_USER_ID": ""},
])
def test_rejects_invalid_or_unsafe_configuration(env):
    with pytest.raises(ConfigurationError, match="Invalid configuration:"):
        load_config(env)


def test_deny_by_default_does_not_trust_identity_headers():
    with TestClient(create_app(env={}, log=lambda _: None)) as client:
        response = client.get("/api/v1/runtime/context", headers={
            "x-user-id": "forged-user", "x-request-id": "trace-1",
        })
        assert response.status_code == 401
        assert response.json()["error"]["requestId"] == response.headers["x-request-id"] == "trace-1"
        VALIDATOR.validate(response.json())
        assert client.get("/health").status_code == 200
        readiness = client.get("/ready")
        assert readiness.status_code == 503
        VALIDATOR.validate(readiness.json())


def test_development_context_is_fixed_and_malformed_request_ids_are_replaced():
    with TestClient(create_app(env=DEVELOPMENT, log=lambda _: None)) as client:
        response = client.get("/api/v1/runtime/context", headers={
            "x-user-id": "forged-user", "x-request-id": "invalid request",
        })
        body = response.json()
        assert body["principal"] == {"userId": "fixed-user", "source": "development"}
        assert body["requestId"] == response.headers["x-request-id"] != "invalid request"
        VALIDATOR.validate(body)


def test_verified_identity_hook_and_verifier_failure():
    with pytest.raises(ConfigurationError, match="verifier"):
        create_app(env={"AUTH_MODE": "verified"})

    async def verify(request: Request):
        return Identity(userId="verified-user") if request.headers.get("authorization") == "Bearer test-credential" else None

    with TestClient(create_app(env={"AUTH_MODE": "verified"}, verify_identity=verify, log=lambda _: None)) as client:
        assert client.get("/api/v1/runtime/context").status_code == 401
        response = client.get("/api/v1/runtime/context", headers={"authorization": "Bearer test-credential"})
        assert response.json()["principal"] == {"userId": "verified-user", "source": "verified"}
        VALIDATOR.validate(response.json())

    async def failed(_request: Request):
        raise RuntimeError("private-verifier-detail")

    with TestClient(create_app(env={"AUTH_MODE": "verified"}, verify_identity=failed, log=lambda _: None)) as client:
        response = client.get("/api/v1/runtime/context")
        assert response.status_code == 503
        assert response.json()["error"]["code"] == "DEPENDENCY_UNAVAILABLE"
        assert "private-verifier-detail" not in response.text
        VALIDATOR.validate(response.json())


def test_input_errors_and_logs_do_not_expose_values_or_exception_details():
    records = []
    app = create_app(env=DEVELOPMENT, log=records.append)

    class Input(StrictBody):
        value: str

    @app.post("/api/v1/checks/input")
    def input_body(value: Input):
        return {"accepted": bool(value.value)}

    @app.get("/api/v1/checks/failure")
    def failure():
        raise RuntimeError("private-database-string")

    with TestClient(app) as client:
        for body in [{"value": 123}, {"value": "valid", "extra": "private-body"}]:
            response = client.post("/api/v1/checks/input", json=body)
            assert response.status_code == 400
            assert response.json()["error"]["code"] == "INVALID_REQUEST"
            assert "private-body" not in response.text
            VALIDATOR.validate(response.json())
        malformed = client.post("/api/v1/checks/input", content="{broken", headers={"content-type": "application/json"})
        assert malformed.status_code == 400
        assert client.post("/api/v1/checks/input", json={"value": "valid"}).status_code == 200
        response = client.get("/api/v1/checks/failure?token=private-query", headers={
            "authorization": "Bearer private-credential", "cookie": "private-cookie", "x-request-id": "trace-errors",
        })
        assert response.status_code == 500
        assert response.json()["error"]["requestId"] == "trace-errors"
        assert "private-database-string" not in response.text
        VALIDATOR.validate(response.json())
        client.get("/private-place?token=private-query")
    serialized = json.dumps(records)
    for value in ["private-", "fixed-user", "authorization", "cookie"]:
        assert value not in serialized
    assert records[-2]["route"] == "/api/v1/checks/failure"


def test_liveness_is_separate_from_dependency_readiness():
    async def unavailable():
        return False

    with TestClient(create_app(env=DEVELOPMENT, readiness_checks=[unavailable], log=lambda _: None)) as client:
        assert client.get("/health").status_code == 200
        response = client.get("/ready")
        assert response.status_code == 503
        assert response.json()["status"] == "not_ready"
    with TestClient(create_app(env=DEVELOPMENT, log=lambda _: None)) as client:
        assert client.get("/ready").status_code == 200


def test_documented_errors_versioning_and_production_docs():
    with TestClient(create_app(env={}, log=lambda _: None)) as client:
        document = client.get("/openapi.json").json()
        operation = document["paths"]["/api/v1/runtime/context"]["get"]
        assert operation["security"] == [{"bearerAuth": []}]
        assert "422" not in operation["responses"]
        assert "ErrorEnvelope" in operation["responses"]["401"]["content"]["application/json"]["schema"]["$ref"]
        method = client.post("/health")
        assert method.status_code == 405
        VALIDATOR.validate(method.json())
    with TestClient(create_app(env={"APP_ENV": "production"}, log=lambda _: None)) as client:
        for path in ["/docs", "/openapi.json"]:
            assert client.get(path).status_code == 404


def test_exact_cors_origin_allowlist():
    with TestClient(create_app(env={"CORS_ORIGINS": "http://localhost:5173"}, log=lambda _: None)) as client:
        allowed = client.get("/health", headers={"origin": "http://localhost:5173"})
        denied = client.get("/health", headers={"origin": "https://untrusted.example"})
        assert allowed.headers["access-control-allow-origin"] == "http://localhost:5173"
        assert "access-control-allow-origin" not in denied.headers


def test_transport_log_formatter_does_not_serialize_private_messages():
    record = logging.LogRecord("uvicorn.error", logging.ERROR, __file__, 1,
                               "private-url private-credential", (), None)
    result = ServerLogFormatter().format(record)
    assert "private-" not in result
    assert json.loads(result) == {"event": "http.server", "service": "ai-api", "level": "ERROR"}
