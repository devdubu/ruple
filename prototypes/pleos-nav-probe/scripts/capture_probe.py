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

PROJECT = Path(__file__).resolve().parents[1]
REPO = PROJECT.parents[1]
PACKAGE = "com.ruple.probe"


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
    args = parser.parse_args()
    if not re.fullmatch(r"[a-zA-Z0-9_-]+", args.label) or args.seconds < 1:
        parser.error("Use a simple label and a positive observation duration")
    sdk = Path(os.environ.get("ANDROID_HOME", Path.home() / "Library/Android/sdk"))
    adb_path = shutil.which("adb") or str(sdk / "platform-tools/adb")

    def adb(*cmd, check=True):
        return subprocess.run([adb_path, "-s", args.serial, *cmd],
                              capture_output=True, check=check, timeout=60)

    if adb("shell", "getprop", "ro.kernel.qemu").stdout.strip() != b"1":
        parser.error("This capture command is limited to an emulator")
    if adb("shell", "getprop", "sys.boot_completed").stdout.strip() != b"1":
        parser.error("Wait for emulator boot completion")
    user = adb("shell", "am", "get-current-user").stdout.decode().strip()
    if not user.isdigit():
        parser.error("Cannot identify the current automotive Android user")

    def app_file(*cmd, check=True):
        return adb("shell", "run-as", PACKAGE, "--user", user, *cmd, check=check)

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    folder = REPO / "local-artifacts/pleos-nav-probe" / f"{stamp}-{args.label}"
    folder.mkdir(parents=True, exist_ok=False)
    environment = {
        "runtime": "emulator", "label": args.label, "serial": args.serial, "android_user": user,
        "fingerprint": adb("shell", "getprop", "ro.build.fingerprint").stdout.decode().strip(),
        "max_observation_seconds": args.seconds,
    }
    (folder / "environment.json").write_text(json.dumps(environment, indent=2) + "\n")
    apk = PROJECT / "app/build/outputs/apk/debug/app-debug.apk"
    adb("install", "--user", user, "-r", str(apk))
    adb("shell", "am", "force-stop", "--user", user, PACKAGE)
    app_file("rm", "-f", "no_backup/latest-session.txt")
    adb("shell", "am", "start", "--user", user, "-n", f"{PACKAGE}/.MainActivity")
    capture_started = time.monotonic()
    deadline = capture_started + args.seconds
    data = b""
    while time.monotonic() < deadline:
        latest = app_file("cat", "no_backup/latest-session.txt", check=False)
        name = latest.stdout.decode().strip()
        if re.fullmatch(r"probe-[a-f0-9-]+\.jsonl", name):
            result = app_file("cat", f"no_backup/{name}", check=False)
            if result.returncode == 0:
                data = result.stdout
                (folder / "events.jsonl").write_bytes(data)
                events = [json.loads(line) for line in data.splitlines() if line.strip()]
                if can_finish_capture(events):
                    break
        time.sleep(2)
    if not data:
        raise RuntimeError(f"No event file captured; inspect emulator. Output: {folder}")
    events = [json.loads(line) for line in data.splitlines() if line.strip()]
    result = summarize(events)
    environment["collected_seconds"] = round(time.monotonic() - capture_started, 3)
    (folder / "environment.json").write_text(json.dumps(environment, indent=2) + "\n")
    (folder / "summary.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"local_output": str(folder), "summary": result}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
