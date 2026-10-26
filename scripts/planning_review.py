#!/usr/bin/env python3
"""Reproduce planning assumptions and collect bounded local resource observations.

No remote server login, SDK calls, account data, audio or location collection.
"""
import argparse
import datetime as dt
import json
from pathlib import Path
import platform
import shutil
import subprocess


def command(argv):
    try:
        result = subprocess.run(argv, capture_output=True, text=True, timeout=15)
        return {"exit_code": result.returncode,
                "output": (result.stdout or result.stderr).strip()[:1200]}
    except (OSError, subprocess.TimeoutExpired) as exc:
        return {"exit_code": None, "output": str(exc)}


def capacity(args):
    start = dt.date.fromisoformat(args.start)
    finish = dt.date.fromisoformat(args.finish)
    if finish < start or any(h < 0 for h in args.hours):
        raise ValueError("Invalid date range or negative hours")
    if not args.weekdays or any(d < 0 or d > 6 for d in args.weekdays):
        raise ValueError("weekdays must use Monday=0 through Sunday=6")
    dates = []
    day = start
    while day <= finish:
        if day.weekday() in args.weekdays:
            dates.append(day.isoformat())
        day += dt.timedelta(days=1)
    by_person = [len(dates) * h for h in args.hours]
    return {
        "kind": "planning_assumptions_not_committed_capacity",
        "start_inclusive": start.isoformat(),
        "finish_inclusive": finish.isoformat(),
        "weekdays_monday_zero": args.weekdays,
        "assumed_daily_hours_by_slot": args.hours,
        "assumptions": [
            "Full-time daily hours and working weekdays are planning assumptions.",
            "Four hours for each employed member is a user-stated daily maximum.",
            "All selected days at the maximum is an upper-bound scenario.",
            "PM, specification, review, integration, tests and submission consume these hours.",
            "Leave, overtime, meetings and skill differences are not measured.",
            "Slots are not assignments of named people."
        ],
        "working_dates": dates,
        "working_day_count": len(dates),
        "theoretical_person_hours_by_slot": by_person,
        "theoretical_total_person_hours": sum(by_person)
    }


def resources(args):
    sdk = Path(args.sdk).expanduser()
    avd = Path(args.avd).expanduser()
    repo = Path(args.repo).resolve()
    adb = sdk / "platform-tools/adb"
    emulator = sdk / "emulator/emulator"
    disk = shutil.disk_usage(repo)
    out = {
        "observed_at_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
        "kind": "local_shell_observation_not_remote_or_sdk_verification",
        "architecture": platform.machine(),
        "python": platform.python_version(),
        "android_sdk_directory_exists": sdk.is_dir(),
        "pleos_avd_config_exists": avd.is_file(),
        "android_studio_directory_exists": Path(args.studio).expanduser().is_dir(),
        "docker_cli_present": shutil.which("docker") is not None,
        "docker_daemon_tested": False,
        "disk_free_bytes_on_repo_volume": disk.free,
        "remote_server": {"availability": "user_reported", "connection_tested": False},
        "dgx_spark": {"availability": "user_reported", "model_runtime_tested": False},
        "android_phone": {"availability": "user_reported", "app_install_tested": False},
        "iphone": {"availability": "user_reported", "app_install_tested": False},
        "sdk_calls_performed": False,
        "emulator_boot_performed": False,
    }
    out["java"] = command([str(Path(args.java).expanduser()), "-version"])
    if platform.system() == "Darwin":
        out["memory_bytes_query"] = command(["sysctl", "-n", "hw.memsize"])
        out["processor_query"] = command(["sysctl", "-n", "machdep.cpu.brand_string"])
    if adb.is_file():
        version = command([str(adb), "version"])
        out["adb_version"] = {"exit_code": version["exit_code"],
                              "output": "\n".join(version["output"].splitlines()[:2])}
        result = command([str(adb), "devices"])
        if result["exit_code"] == 0:
            out["connected_device_states"] = [
                {"type": "emulator" if line.startswith("emulator-") else "physical-or-other",
                 "state": line.split()[1]}
                for line in result["output"].splitlines()[1:] if len(line.split()) >= 2
            ]
        else:
            out["device_query_failure"] = {
                "exit_code": result["exit_code"],
                "permission_denied_in_current_shell": "Operation not permitted" in result["output"],
                "device_list_observed": False
            }
    if emulator.is_file():
        out["emulator_version_probe"] = command([str(emulator), "-version"])
    return out


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="mode", required=True)
    cap = sub.add_parser("capacity")
    cap.add_argument("--start", required=True)
    cap.add_argument("--finish", required=True)
    cap.add_argument("--hours", nargs="+", type=float, required=True)
    cap.add_argument("--weekdays", nargs="+", type=int, default=[0, 1, 2, 3, 4])
    cap.add_argument("--output", type=Path)
    res = sub.add_parser("resources")
    res.add_argument("--repo", type=Path, required=True)
    res.add_argument("--sdk", default="~/Library/Android/sdk")
    res.add_argument("--avd", default="~/.android/avd/Ruple_Pleos_2_1.avd/config.ini")
    res.add_argument("--studio", default="~/Applications/Android Studio.app")
    res.add_argument("--java", default="/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home/bin/java")
    res.add_argument("--output", type=Path)
    args = parser.parse_args()
    try:
        result = capacity(args) if args.mode == "capacity" else resources(args)
    except ValueError as exc:
        parser.error(str(exc))
    encoded = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(encoded, encoding="utf-8")
    else:
        print(encoded, end="")


if __name__ == "__main__":
    main()
