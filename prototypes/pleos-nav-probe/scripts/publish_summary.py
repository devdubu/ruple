#!/usr/bin/env python3
"""Create a shareable observation summary from explicitly selected local runs."""
import argparse
import json
from pathlib import Path

from summarize_probe import summarize


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("runs", nargs="+", type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    runs = []
    for folder in args.runs:
        environment = json.loads((folder / "environment.json").read_text())
        events = [json.loads(line) for line in (folder / "events.jsonl").read_text().splitlines()
                  if line.strip()]
        if environment["runtime"] != "emulator" or any(e["source"] != "pleos_sdk" for e in events):
            raise ValueError("Only explicitly identified emulator SDK observations are supported")
        runs.append({
            "run": folder.name,
            "runtime": environment["runtime"],
            "android_user": environment["android_user"],
            "fingerprint": environment["fingerprint"],
            "started_at": events[0]["observed_at"],
            "summary": summarize(events),
        })
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps({"runs": runs}, ensure_ascii=False, indent=2) + "\n")
    print(f"Wrote sanitized observation summary: {args.output}")


if __name__ == "__main__":
    main()
