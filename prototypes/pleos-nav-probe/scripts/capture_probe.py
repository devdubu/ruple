#!/usr/bin/env python3
"""Install and observe the probe on an explicitly selected, booted emulator."""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import time

from summarize_probe import summarize
from summarize_navigation import summarize_navigation

PROJECT = Path(__file__).resolve().parents[1]
REPO = PROJECT.parents[1]
PACKAGE = "com.ruple.probe"


class CaptureHealth:
    def __init__(self):
        self.successful_reads = 0
        self.last_successful_read_at = None
        self.consecutive_failures = 0
        self.errors = []

    def success(self):
        self.successful_reads += 1
        self.last_successful_read_at = datetime.now(timezone.utc).isoformat()
        self.consecutive_failures = 0

    def failure(self, stage, code=None, error_class=None):
        self.consecutive_failures += 1
        self.errors.append({"at": datetime.now(timezone.utc).isoformat(), "stage": stage,
                            "returncode": code, "error_class": error_class})

    def must_stop(self):
        return self.successful_reads > 0 and self.consecutive_failures >= 3

    def report(self, reason, events):
        return {"termination_reason": reason,
                "integrity": "healthy" if self.successful_reads and not self.consecutive_failures else "incomplete",
                "successful_reads": self.successful_reads,
                "last_successful_read_at": self.last_successful_read_at,
                "read_error_count": len(self.errors), "read_errors": self.errors,
                "observation_finished_observed": any(e["event"] == "navigation_observation_finished" for e in events),
                "sdk_release_observed": any(e["event"] == "sdk_released" for e in events)}


def parse_snapshot(data):
    if not data or not data.endswith(b"\n"):
        raise ValueError("Snapshot is empty or has an incomplete final record")
    return [json.loads(line) for line in data.splitlines() if line.strip()]


def can_finish_capture(events):
    if not events:
        return False
    cycle = max(e["cycle"] for e in events)
    current = [e for e in events if e["cycle"] == cycle]
    received = {e["kind"] for e in current
                if e["event"] == "list_received" and e.get("in_request_window") is True}
    return (any(e["event"] == "cycle_finished" for e in current)
            and received == {"bookmark", "recent"}
            and not any(e["event"] == "callback_not_observed" for e in current))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--serial", required=True)
    parser.add_argument("--label", required=True)
    parser.add_argument("--seconds", type=int, default=100)
    parser.add_argument("--probe", choices=["lists", "navigation"], default="lists")
    args = parser.parse_args()
    if not re.fullmatch(r"[a-zA-Z0-9_-]+", args.label) or args.seconds < 1:
        parser.error("Use a simple label and a positive observation duration")
    sdk = Path(os.environ.get("ANDROID_HOME", Path.home() / "Library/Android/sdk"))
    adb_path = shutil.which("adb") or str(sdk / "platform-tools/adb")

    def adb(*cmd, check=True, timeout=60):
        return subprocess.run([adb_path, "-s", args.serial, *cmd],
                              capture_output=True, check=check, timeout=timeout)

    if adb("shell", "getprop", "ro.kernel.qemu").stdout.strip() != b"1":
        parser.error("This capture command is limited to an emulator")
    if adb("shell", "getprop", "sys.boot_completed").stdout.strip() != b"1":
        parser.error("Wait for emulator boot completion")
    user = adb("shell", "am", "get-current-user").stdout.decode().strip()
    if not user.isdigit():
        parser.error("Cannot identify the current automotive Android user")

    def app_file(*cmd, check=True):
        return adb("shell", "run-as", PACKAGE, "--user", user, *cmd, check=check, timeout=10)

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    folder = REPO / "local-artifacts/pleos-nav-probe" / f"{stamp}-{args.label}"
    folder.mkdir(parents=True, exist_ok=False)
    environment = {
        "runtime": "emulator", "label": args.label, "serial": args.serial, "android_user": user,
        "fingerprint": adb("shell", "getprop", "ro.build.fingerprint").stdout.decode().strip(),
        "max_observation_seconds": args.seconds, "probe": args.probe,
    }
    (folder / "environment.json").write_text(json.dumps(environment, indent=2) + "\n")
    apk = PROJECT / "app/build/outputs/apk/debug/app-debug.apk"
    adb("install", "--user", user, "-r", str(apk))
    adb("shell", "am", "force-stop", "--user", user, PACKAGE)
    navigation = args.probe == "navigation"
    pointer = "latest-navigation-session.txt" if navigation else "latest-session.txt"
    prefix = "navprobe" if navigation else "probe"
    activity = "NavigationProbeActivity" if navigation else "MainActivity"
    app_file("rm", "-f", f"no_backup/{pointer}")
    adb("shell", "am", "start", "--user", user, "-n", f"{PACKAGE}/.{activity}")
    capture_started = time.monotonic()
    deadline = capture_started + args.seconds
    data = b""
    events = []
    health = CaptureHealth()
    expected_name = None
    reason = "observation_timeout"
    while time.monotonic() < deadline:
        try:
            latest = app_file("cat", f"no_backup/{pointer}", check=False)
            name = latest.stdout.decode().strip()
            if latest.returncode != 0 or not re.fullmatch(prefix + r"-[a-f0-9-]+\.jsonl", name):
                health.failure("session_pointer", latest.returncode)
            elif expected_name is not None and name != expected_name:
                health.failure("session_changed")
                reason = "session_changed"
                break
            else:
                result = app_file("cat", f"no_backup/{name}", check=False)
                if result.returncode != 0:
                    health.failure("events_file", result.returncode)
                    if health.must_stop():
                        reason = "read_failure"
                        break
                    time.sleep(2)
                    continue
                parsed = parse_snapshot(result.stdout)
                data, events, expected_name = result.stdout, parsed, name
                health.success()
                (folder / "events.jsonl").write_bytes(data)
                finished = (any(e["event"] == "navigation_observation_finished" for e in events)
                            and any(e["event"] == "sdk_released" for e in events)) if navigation else can_finish_capture(events)
                if finished:
                    reason = "expected_events_observed"
                    break
        except (subprocess.SubprocessError, OSError, ValueError) as error:
            health.failure("read_or_decode", error_class=type(error).__name__)
        if health.must_stop():
            reason = "read_failure"
            break
        time.sleep(2)
    environment["collected_seconds"] = round(time.monotonic() - capture_started, 3)
    environment["collection"] = health.report(reason, events)
    (folder / "environment.json").write_text(json.dumps(environment, indent=2) + "\n")
    if not data:
        raise RuntimeError(f"No event file captured; inspect collector state in {folder}")
    result = summarize_navigation(events) if navigation else summarize(events)
    result["collection"] = environment["collection"]
    (folder / "summary.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"local_output": str(folder), "summary": result}, ensure_ascii=False, indent=2))
    if reason in {"read_failure", "session_changed"} or health.consecutive_failures:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
