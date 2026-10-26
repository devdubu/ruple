#!/usr/bin/env python3
"""Summarize observed events without publishing place names, coordinates or raw errors."""
import argparse
import json
from pathlib import Path


def summarize(events):
    first = events[0]["elapsed_ms"] if events else 0
    return {
        "sdk_versions": sorted({e["sdk"] for e in events if "sdk" in e}),
        "service_connected": any(e["event"] == "service_connected" for e in events),
        "requests": [e["kind"] for e in events if e["event"] == "request_sent"],
        "observations": [
            {
                "event": e["event"],
                "kind": e.get("kind"),
                "count": e.get("count"),
                "in_request_window": e.get("in_request_window"),
                "elapsed_from_start_ms": e["elapsed_ms"] - first,
                "returned_fields": sorted({k for row in e.get("items", [])
                                           if isinstance(row, dict) for k in row}),
                "error_class": e.get("error_class"),
                "sdk_error_code": e.get("error") if e["event"] == "sdk_error" else None,
            }
            for e in events if e["event"] in {
                "list_received", "null_payload", "callback_not_observed", "sdk_error",
                "connection_not_observed", "connection_failed", "initialization_exception",
                "listener_registration_failed", "request_exception", "payload_decode_failed",
            }
        ],
        "cycle_finished": any(e["event"] == "cycle_finished" for e in events),
        "interpretation": "Recorded observations only; SDK events do not contain our request ID."
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("events", type=Path)
    args = parser.parse_args()
    events = [json.loads(line) for line in args.events.read_text().splitlines() if line.strip()]
    print(json.dumps(summarize(events), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
