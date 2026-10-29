"""Boot each isolated track with real owned APIs and contract-backed peer mocks."""
import json
import os
from pathlib import Path
import subprocess
import time
import urllib.error
import urllib.request

from smoke_workspace import HTTP, PORTS, ROOT, running, stop


def response(port, path="/api/v1/runtime/context"):
    try:
        result = HTTP.open(f"http://127.0.0.1:{port}{path}", timeout=2)
    except urllib.error.HTTPError as error:
        result = error
    with result:
        return result.code, result.headers, json.loads(result.read())


def exercise(track):
    assert not any(running(port) for port in PORTS), "Stop dev servers before this check"
    directory = ROOT / "local-artifacts" / "isolated-smoke"
    directory.mkdir(parents=True, exist_ok=True)
    env = dict(os.environ, NX_DAEMON="false", NX_ISOLATE_PLUGINS="false", NX_TUI="false")
    for name in ["PORT", "CORS_ORIGINS", "RUPLE_DEV_STATE_DIR"]:
        env.pop(name, None)
    peer = "automation" if track == "a" else "context"
    own_ports = [3001] if track == "a" else [3002, 3003, 3004]
    mock_ports = [3002, 3003, 3010] if track == "a" else [3001, 3010]
    expected = [5173, *own_ports, *mock_ports]
    def scenario(value):
        subprocess.run(["node", "tools/development/cli.mjs", "scenario", track, peer, value],
                       cwd=ROOT, env=env, check=True, capture_output=True)
    subprocess.run(["node", "tools/development/cli.mjs", "prepare", track],
                   cwd=ROOT, env=env, check=True, capture_output=True)
    config = ROOT / "local-artifacts" / "development" / track / "mocks.json"
    previous = config.read_bytes()
    scenario("success")
    with (directory / f"{track}.log").open("w") as log:
        process = subprocess.Popen(["node", "tools/development/cli.mjs", "dev", track],
                                   cwd=ROOT, env=env, stdout=log, stderr=log, start_new_session=True)
        try:
            deadline = time.monotonic() + 45
            while not all(running(port) for port in expected) and time.monotonic() < deadline:
                assert process.poll() is None, f"Track {track} exited; inspect {directory}"
                time.sleep(0.2)
            assert all(running(port) for port in expected), f"Track {track} did not start"
            for port in own_ports:
                status, headers, _ = response(port)
                assert status == 200
                assert headers.get("x-ruple-mock") is None
            for port in mock_ports:
                status, headers, _ = response(port)
                assert status == 200 and headers.get("x-ruple-mock") == "true"
            status, headers, _ = response(5173, f"/services/{peer}/api/v1/runtime/context")
            assert status == 200 and headers.get("x-ruple-mock") == "true"
            scenario("unavailable")
            assert response(5173, f"/services/{peer}/api/v1/runtime/context")[0] == 503
            scenario("success")
            assert response(5173, f"/services/{peer}/api/v1/runtime/context")[0] == 200
            print(f"Isolated track {track}: owned APIs, mocked peers, proxy, and recovery passed", flush=True)
        finally:
            stop(process)
            config.write_bytes(previous)
    deadline = time.monotonic() + 6
    while any(running(port) for port in expected) and time.monotonic() < deadline:
        time.sleep(0.1)
    assert not any(running(port) for port in expected), f"Track {track} left a server running"


if __name__ == "__main__":
    if os.name != "posix":
        raise SystemExit("Run this process-group check in Linux, macOS, or WSL")
    for track in ["a", "b"]:
        exercise(track)
