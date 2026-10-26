#!/usr/bin/env python3
"""Extract only expected probe/navigation foreground components and screenshot hashes."""
import argparse
import hashlib
import json
from pathlib import Path
import re

COMPONENTS = {"probe": "com.ruple.probe/.NavigationProbeActivity",
              "navigation": "ai.umos.maps.android.navigation.app/.MainActivity"}


def snapshot(activity_file, screen_file):
    current = set(re.findall(r"topResumedActivity=ActivityRecord\{[^\n]*?\bu\d+\s+(\S+)",
                             activity_file.read_text()))
    return {"foreground": {label: component in current for label, component in COMPONENTS.items()},
            "activity_file": activity_file.name, "screen_file": screen_file.name,
            "screen_sha256": hashlib.sha256(screen_file.read_bytes()).hexdigest()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for argument in ["before_activities", "after_activities", "before_screen", "after_screen", "output"]:
        parser.add_argument("--" + argument.replace("_", "-"), type=Path, required=True)
    args = parser.parse_args()
    before = snapshot(args.before_activities, args.before_screen)
    after = snapshot(args.after_activities, args.after_screen)
    result = {"before": before, "after": after,
              "expected_foreground_transition_observed": before["foreground"]["probe"]
              and not before["foreground"]["navigation"] and after["foreground"]["navigation"]
              and not after["foreground"]["probe"],
              "screen_content_verdict": "Screenshots require visual review; Activity parsing alone does not verify content"}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(f"Wrote sanitized screen transition: {args.output}")


if __name__ == "__main__":
    main()
