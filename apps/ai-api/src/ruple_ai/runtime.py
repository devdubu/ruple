"""HTTP conventions shared with the Node services; no inference or business rules."""

import json
import logging
import os
import re
from collections.abc import Awaitable, Callable, Mapping
from dataclasses import dataclass
from time import perf_counter
from typing import Literal
from urllib.parse import urlsplit
from uuid import uuid4
from weakref import WeakSet

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from starlette.exceptions import HTTPException as StarletteHTTPException

ID_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$"
REQUEST_ID_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$"
ERRORS = {
    400: ("INVALID_REQUEST", "Request validation failed."),
    401: ("UNAUTHENTICATED", "Authentication is required."),
    403: ("FORBIDDEN", "Access is denied."),
    404: ("NOT_FOUND", "Resource was not found."),
    405: ("METHOD_NOT_ALLOWED", "HTTP method is not allowed."),
    408: ("REQUEST_TIMEOUT", "Request timed out."),
    409: ("CONFLICT", "Resource version or state conflicts."),
    413: ("PAYLOAD_TOO_LARGE", "Request payload is too large."),
    415: ("UNSUPPORTED_MEDIA_TYPE", "Request media type is not supported."),
    429: ("RATE_LIMITED", "Too many requests."),
    503: ("DEPENDENCY_UNAVAILABLE", "A required dependency is unavailable."),
    502: ("DEPENDENCY_UNAVAILABLE", "A required dependency is unavailable."),
    504: ("DEPENDENCY_UNAVAILABLE", "A required dependency is unavailable."),
    500: ("INTERNAL_ERROR", "An internal error occurred."),
}
PUBLIC_ENDPOINTS: WeakSet[object] = WeakSet()


class StrictBody(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class Identity(StrictBody):
    userId: str = Field(pattern=ID_PATTERN)
    deviceId: str | None = Field(default=None, pattern=ID_PATTERN)
    vehicleId: str | None = Field(default=None, pattern=ID_PATTERN)


class Principal(Identity):
    source: Literal["development", "verified"]


class RuntimeContext(StrictBody):
    requestId: str = Field(pattern=REQUEST_ID_PATTERN)
    principal: Principal


class HealthResponse(StrictBody):
    status: Literal["ok"]
    service: str


class ReadinessResponse(StrictBody):
    status: Literal["ready", "not_ready"]
    service: str


class ErrorDetail(StrictBody):
    code: Literal[
        "INVALID_REQUEST", "UNAUTHENTICATED", "FORBIDDEN", "NOT_FOUND", "CONFLICT",
        "PAYLOAD_TOO_LARGE", "RATE_LIMITED", "DEPENDENCY_UNAVAILABLE", "INTERNAL_ERROR",
        "METHOD_NOT_ALLOWED", "REQUEST_TIMEOUT", "UNSUPPORTED_MEDIA_TYPE",
    ]
    message: str
    requestId: str = Field(pattern=REQUEST_ID_PATTERN)


class ErrorEnvelope(StrictBody):
    error: ErrorDetail


class ConfigurationError(ValueError):
    pass


@dataclass(frozen=True)
class Config:
    environment: str
    host: str
    port: int
    auth_mode: str
    docs_enabled: bool
    development_identity: Identity
    cors_origins: list[str]


def load_config(env: Mapping[str, str] | None = None) -> Config:
    env = os.environ if env is None else env
    environment = env.get("APP_ENV", env.get("NODE_ENV", "development"))
    if environment not in {"development", "test", "production"} or (
        env.get("NODE_ENV") == "production" and environment != "production"
    ):
        raise ConfigurationError("Invalid configuration: APP_ENV/NODE_ENV")
    raw_port = env.get("PORT", "3010")
    if not re.fullmatch(r"[0-9]+", raw_port) or not 1 <= int(raw_port) <= 65535:
        raise ConfigurationError("Invalid configuration: PORT")
    host = env.get("HOST", "127.0.0.1")
    if host not in {"127.0.0.1", "::1", "0.0.0.0", "::"}:
        raise ConfigurationError("Invalid configuration: HOST")
    auth_mode = env.get("AUTH_MODE", "deny")
    if auth_mode not in {"deny", "development", "verified"} or (
        auth_mode == "development" and (environment == "production" or host not in {"127.0.0.1", "::1"})
    ):
        raise ConfigurationError("Invalid configuration: AUTH_MODE")
    docs = env.get("DOCS_ENABLED", "false" if environment == "production" else "true")
    if docs not in {"true", "false"} or (environment == "production" and docs == "true"):
        raise ConfigurationError("Invalid configuration: DOCS_ENABLED")
    try:
        identity = Identity(
            userId=env.get("DEV_USER_ID", "dev-user"),
            deviceId=env.get("DEV_DEVICE_ID"), vehicleId=env.get("DEV_VEHICLE_ID"),
        ) if auth_mode == "development" else Identity(userId="dev-user")
    except ValueError:
        raise ConfigurationError("Invalid configuration: DEV_*_ID") from None
    origins = env["CORS_ORIGINS"].split(",") if "CORS_ORIGINS" in env else []
    for origin in origins:
        try:
            url = urlsplit(origin)
            if url.scheme not in {"http", "https"} or not url.netloc or url.path or url.query or url.fragment:
                raise ValueError()
            if url.username or url.password or not url.hostname:
                raise ValueError()
            _ = url.port
        except ValueError:
            raise ConfigurationError("Invalid configuration: CORS_ORIGINS") from None
    return Config(environment, host, int(raw_port), auth_mode, docs == "true", identity, origins)


def json_log(record: dict) -> None:
    print(json.dumps(record, separators=(",", ":")), flush=True)


class ServerLogFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        return json.dumps({"event": "http.server", "service": "ai-api", "level": record.levelname})


def error_response(status: int, request_id: str) -> JSONResponse:
    status = 400 if status == 422 else status if status in ERRORS else 500
    code, message = ERRORS[status]
    return JSONResponse(status_code=status, content={
        "error": {"code": code, "message": message, "requestId": request_id}
    })


def public[T](endpoint: T) -> T:
    PUBLIC_ENDPOINTS.add(endpoint)
    return endpoint


def trace_headers(request: Request) -> dict[str, str]:
    return {"x-request-id": request.state.request_id}


def create_app(
    *, env: Mapping[str, str] | None = None,
    verify_identity: Callable[[Request], Awaitable[Identity | None]] | None = None,
    readiness_checks: list[Callable[[], Awaitable[bool]]] | None = None,
    log: Callable[[dict], None] = json_log,
) -> FastAPI:
    import asyncio

    config = load_config(env)
    if config.auth_mode == "verified" and verify_identity is None:
        raise ConfigurationError("Invalid configuration: AUTH_MODE verifier")

    async def require_identity(request: Request):
        if request.scope.get("endpoint") in PUBLIC_ENDPOINTS:
            return
        identity = None
        if config.auth_mode == "development":
            identity = config.development_identity
        if config.auth_mode == "verified" and verify_identity is not None:
            try:
                identity = await verify_identity(request)
            except Exception:  # noqa: BLE001 -- verification boundary must not expose provider errors
                raise HTTPException(503) from None
        if not isinstance(identity, Identity):
            raise HTTPException(401)
        request.state.principal = Principal(
            **identity.model_dump(include={"userId", "deviceId", "vehicleId"}),
            source="development" if config.auth_mode == "development" else "verified",
        )

    class RuntimeApp(FastAPI):
        def openapi(self) -> dict:
            return schema_document()

    app = RuntimeApp(
        title="Ruple AI API", version="1.0.0", dependencies=[Depends(require_identity)],
        docs_url="/docs" if config.docs_enabled else None, redoc_url=None,
        openapi_url="/openapi.json" if config.docs_enabled else None,
    )
    app.state.config = config
    if config.cors_origins:
        app.add_middleware(CORSMiddleware, allow_origins=config.cors_origins,
                           allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
                           allow_headers=["content-type", "authorization", "x-request-id"],
                           expose_headers=["x-request-id"], allow_credentials=False)

    @app.middleware("http")
    async def trace(request: Request, call_next):
        values = request.headers.getlist("x-request-id")
        request_id = values[0] if len(values) == 1 and re.fullmatch(REQUEST_ID_PATTERN, values[0]) else str(uuid4())
        request.state.request_id = request_id
        start = perf_counter()
        try:
            response = await call_next(request)
        except Exception:  # noqa: BLE001 -- final HTTP boundary sanitizes unexpected failures
            response = error_response(500, request_id)
        response.headers["x-request-id"] = request_id
        log({"event": "http.request.completed", "service": "ai-api", "requestId": request_id,
             "method": request.method, "route": getattr(request.scope.get("route"), "path", "__unmatched__"),
             "status": response.status_code, "durationMs": round((perf_counter() - start) * 1000)})
        return response

    @app.exception_handler(StarletteHTTPException)
    async def http_error(request: Request, error: StarletteHTTPException):
        return error_response(error.status_code, request.state.request_id)

    @app.exception_handler(RequestValidationError)
    async def invalid_request(request: Request, _error: RequestValidationError):
        return error_response(400, request.state.request_id)

    @app.get("/health", response_model=HealthResponse)
    @public
    def health() -> dict[str, str]:
        return {"status": "ok", "service": "ai-api"}

    @app.get("/ready", response_model=ReadinessResponse, responses={503: {"model": ReadinessResponse}})
    @public
    async def ready():
        available = config.auth_mode != "deny"
        try:
            checks = await asyncio.gather(*(
                asyncio.wait_for(probe(), timeout=1) for probe in readiness_checks or []
            ))
            available = available and all(value is True for value in checks)
        except Exception:  # noqa: BLE001 -- any probe failure makes this instance unavailable
            available = False
        return JSONResponse(status_code=200 if available else 503,
                            content={"status": "ready" if available else "not_ready", "service": "ai-api"})

    @app.get("/api/v1/runtime/context", response_model=RuntimeContext, response_model_exclude_none=True)
    def context(request: Request):
        return {"requestId": request.state.request_id, "principal": request.state.principal}

    def schema_document():
        if app.openapi_schema is not None:
            return app.openapi_schema
        schema = get_openapi(title=app.title, version=app.version, routes=app.routes)
        components = schema.setdefault("components", {})
        models = components.setdefault("schemas", {})
        error_schema = ErrorEnvelope.model_json_schema(ref_template="#/components/schemas/{model}")
        models.update(error_schema.pop("$defs", {}))
        models["ErrorEnvelope"] = error_schema
        components["securitySchemes"] = {"bearerAuth": {"type": "http", "scheme": "bearer"}}
        for path, item in schema["paths"].items():
            for operation in item.values():
                operation.setdefault("parameters", []).append({
                    "name": "x-request-id", "in": "header", "required": False,
                    "schema": {"type": "string", "pattern": REQUEST_ID_PATTERN},
                })
                if path not in {"/health", "/ready"}:
                    operation["security"] = [{"bearerAuth": []}]
                responses = operation.setdefault("responses", {})
                responses.pop("422", None)
                for status, (_code, message) in ERRORS.items():
                    responses.setdefault(str(status), {"description": message, "content": {
                        "application/json": {"schema": {"$ref": "#/components/schemas/ErrorEnvelope"}}
                    }})
        app.openapi_schema = schema
        return schema

    return app
