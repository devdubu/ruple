#!/usr/bin/env python3
"""Summarize navigation observations without exporting location values or assuming execution."""
import argparse
from collections import Counter
import json
from pathlib import Path


def summarize_navigation(events):
    first = events[0]["elapsed_ms"] if events else 0
    target = None
    paused = False
    background_callbacks = []
    observations = []
    for e in events:
        if e["event"] == "activity_paused": paused = True
        if e["event"] == "activity_resumed": paused = False
        if paused and e.get("source") == "pleos_sdk_callback": background_callbacks.append(e["event"])
        if e["event"] == "operator_route_selected":
            target = e["target"]
        row = {k: e[k] for k in ["event", "source", "attempt_at_event", "phase_at_event", "api",
                                 "status", "error", "error_class", "emulator_guard"] if k in e}
        row["elapsed_from_start_ms"] = e["elapsed_ms"] - first
        payload = e.get("payload")
        if isinstance(payload, dict):
            row["payload_fields"] = sorted(payload)
            if e["event"] == "route_state_info":
                row["route_state"] = {k: payload[k] for k in
                                      ["naviMode", "isRouting", "routeOption", "termsAgreement"]
                                      if k in payload}
            if e["event"] == "destination_info" and target:
                row["matches_last_test_target"] = {
                    "poi_id": bool(target.get("poiId")) and payload.get("poiId") == target["poiId"],
                    "name": payload.get("name") == target.get("name"),
                    "coordinates_exact": all(payload.get(k) == target.get(k)
                                             for k in ["latitude", "longitude"]),
                }
        observations.append(row)
    counts = Counter(e["event"] for e in events)
    return {
        "event_counts": dict(sorted(counts.items())),
        "sdk_versions": sorted({e["sdk"] for e in events if "sdk" in e}),
        "app_versions": sorted({e["app_version"] for e in events if "app_version" in e}),
        "callbacks_while_paused": background_callbacks,
        "service_connected": counts["service_connected"] > 0,
        "routing_completed_observed": counts["routing_completed"] > 0,
        "legacy_route_ended_observed": counts["route_ended"] > 0,
        "route_cancelled_observed": counts["route_cancelled"] > 0,
        "destination_arrived_observed": counts["destination_arrived"] > 0,
        "screen_request_returned": any(e["event"] == "api_returned" and
                                       e.get("api") == "requestNavigationScreen.Foreground" for e in events),
        "screen_display_verdict": "Requires independent foreground Activity and screen observation",
        "observations": observations,
        "interpretation": "Events lack this probe's request ID; phase and attempt describe receipt time only.",
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("events", type=Path)
    args = parser.parse_args()
    events = [json.loads(line) for line in args.events.read_text().splitlines() if line.strip()]
    print(json.dumps(summarize_navigation(events), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
