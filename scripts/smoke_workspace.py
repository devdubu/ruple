"""Linux/macOS smoke test of real track commands and compiled entrypoints."""

import json
import os
from pathlib import Path
import signal
import subprocess
import time
import urllib.request
import urllib.error

ROOT = Path(__file__).resolve().parents[1]
LOGS = ROOT / "local-artifacts" / "workspace-smoke"
ENV = dict(os.environ, NX_DAEMON="false", NX_ISOLATE_PLUGINS="false", NX_TUI="false",
           APP_ENV="development", NODE_ENV="development", AUTH_MODE="deny",
           DOCS_ENABLED="true", HOST="127.0.0.1")
ENV.pop("PORT", None)
ENV.pop("CORS_ORIGINS", None)
HTTP = urllib.request.build_opener(urllib.request.ProxyHandler({}))
PORTS = [5173, 3001, 3002, 3003, 3004, 3010]


def read(port, path="/health"):
    with HTTP.open(f"http://127.0.0.1:{port}{path}", timeout=1) as response:
        return response.read().decode()


def running(port):
    try:
        read(port, "/" if port == 5173 else "/health")
        return True
    except urllib.error.HTTPError:
        return True
    except OSError:
        return False


def check_backend(port):
    request = urllib.request.Request(
        f"http://127.0.0.1:{port}/api/v1/runtime/context",
        headers={"x-request-id": "smoke-request", "x-user-id": "forged-user"},
    )
    try:
        HTTP.open(request, timeout=2)
        raise AssertionError("Protected endpoint unexpectedly accepted a forged identity")
    except urllib.error.HTTPError as error:
        body = json.loads(error.read())
        assert error.code == 401
        assert body["error"]["code"] == "UNAUTHENTICATED"
        assert body["error"]["requestId"] == error.headers["x-request-id"] == "smoke-request"
    try:
        read(port, "/ready")
        raise AssertionError("Unconfigured authentication unexpectedly passed readiness")
    except urllib.error.HTTPError as error:
        assert error.code == 503
        assert json.loads(error.read())["status"] == "not_ready"
    document = json.loads(read(port, "/openapi.json"))
    assert "/api/v1/runtime/context" in document["paths"]


def stop(process):
    try:
        os.killpg(process.pid, signal.SIGTERM)
    except ProcessLookupError:
        return
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        os.killpg(process.pid, signal.SIGKILL)
        process.wait(timeout=5)


def exercise(command, expected, name, track=None):
    # A preceding browser test may still be finishing graceful child-process shutdown.
    deadline = time.monotonic() + 5
    while any(running(port) for port in PORTS) and time.monotonic() < deadline:
        time.sleep(0.1)
    for port in PORTS:
        assert not running(port), f"Port {port} already occupied; stop dev servers first"
    path = LOGS / f"{name}.log"
    with path.open("w") as log:
        process = subprocess.Popen(
            command, cwd=ROOT, env=ENV, stdout=log, stderr=log, start_new_session=True
        )
        try:
            pending = set(expected)
            deadline = time.monotonic() + 40
            while pending and time.monotonic() < deadline:
                if process.poll() is not None:
                    raise RuntimeError(f"{name} exited: {path.read_text()[-5000:]}")
                for port in list(pending):
                    try:
                        payload = read(port, "/" if port == 5173 else "/health")
                        if port == 5173:
                            assert "<title>루플레" in payload
                        else:
                            assert json.loads(payload) == {
                                "status": "ok", "service": expected[port]
                            }
                        pending.remove(port)
                    except OSError:
                        pass
                if pending:
                    time.sleep(0.2)
            assert not pending, f"{name}: missing {pending}; {path.read_text()[-5000:]}"
            for port in set(PORTS) - set(expected):
                assert not running(port), f"{name} unexpectedly started port {port}"
            for port in expected:
                if port != 5173:
                    check_backend(port)
            if 5173 in expected:
                for service, port in [("context", 3001), ("automation", 3002), ("interaction", 3003), ("ai", 3010)]:
                    if port in expected:
                        payload = json.loads(read(5173, f"/services/{service}/health"))
                        assert payload == {"status": "ok", "service": expected[port]}, service
            if track:
                source = read(5173, "/src/main.tsx").replace(" ", "")
                assert f'"VITE_DEV_TRACK":"{track}"' in source, source[:1000]
            print(f"{name}: expected services healthy; other ports inactive", flush=True)
        finally:
            stop(process)
    deadline = time.monotonic() + 5
    while any(running(port) for port in expected) and time.monotonic() < deadline:
        time.sleep(0.1)
    assert not any(running(port) for port in expected), f"{name} left a server running"


def main():
    if os.name != "posix":
        raise SystemExit("Run this process-group smoke test in Linux, macOS, or WSL")
    LOGS.mkdir(parents=True, exist_ok=True)
    exercise(["pnpm", "dev:a"],
             {5173: "web", 3001: "context-api", 3010: "ai-api"}, "track-a", track="a")
    exercise(["pnpm", "dev:b"],
             {5173: "web", 3002: "automation-api", 3003: "interaction-api", 3004: "automation-worker"},
             "track-b", track="b")
    for name, port in [
        ("context-api", 3001), ("automation-api", 3002),
        ("interaction-api", 3003), ("automation-worker", 3004)
    ]:
        exercise(["node", f"apps/{name}/dist/main.js"], {port: name}, f"built-{name}")


if __name__ == "__main__":
    main()
