#!/usr/bin/env python3
"""Confirm selected emulator package versions and probe permission grants after a run."""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import subprocess


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--serial", required=True)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    sdk = Path(os.environ.get("ANDROID_HOME", Path.home() / "Library/Android/sdk"))

    def adb(*cmd):
        return subprocess.check_output([str(sdk / "platform-tools/adb"), "-s", args.serial,
                                        *cmd], text=True, timeout=30)

    if adb("shell", "getprop", "ro.kernel.qemu").strip() != "1":
        parser.error("Emulator confirmation only")
    versions = {}
    probe_dump = ""
    for package in ["com.ruple.probe", "ai.pleos.playground.service.navi", "ai.umos.maps.android.navigation.app"]:
        dump = adb("shell", "dumpsys", "package", package)
        version = re.search(r"\bversionName=(\S+)", dump)
        if not version:
            raise RuntimeError(f"Cannot verify package version: {package}")
        versions[package] = version.group(1)
        if package == "com.ruple.probe": probe_dump = dump
    permissions = {}
    for name in ["NAVI_ROUTE", "NAVI_ROUTE_SEARCH", "NAVI_CUSTOM_MAP"]:
        match = re.search(r"pleos\.car\.permission\." + name + r": granted=(true|false)", probe_dump)
        permissions[name] = match.group(1) if match else "not_observed"
    result = {"captured_at": datetime.now(timezone.utc).isoformat(),
              "purpose": "Post-run installed environment confirmation; no SDK calls",
              "fingerprint": adb("shell", "getprop", "ro.build.fingerprint").strip(),
              "packages": versions, "probe_permissions": permissions}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
