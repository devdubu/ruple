"""Collector interpretation tests, distinct from live SDK verification."""
import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from summarize_navigation import summarize_navigation


def event(kind, **fields):
    return {"event": kind, "source": "test_only", "elapsed_ms": 0, **fields}


class NavigationSummaryTest(unittest.TestCase):
    def test_legacy_completion_remains_distinct_from_new_callback_and_arrival(self):
        result = summarize_navigation([event("route_ended")])
        self.assertTrue(result["legacy_route_ended_observed"])
        self.assertFalse(result["routing_completed_observed"])
        self.assertFalse(result["destination_arrived_observed"])

    def test_request_return_is_neither_route_completion_nor_screen_confirmation(self):
        result = summarize_navigation([
            event("api_returned", api="requestRoute"),
            event("api_returned", api="requestNavigationScreen.Foreground")])
        self.assertFalse(result["routing_completed_observed"])
        self.assertTrue(result["screen_request_returned"])
        self.assertIn("independent", result["screen_display_verdict"])
        self.assertFalse(result["destination_arrived_observed"])

    def test_destination_values_are_matched_but_not_exported(self):
        target = {"latitude": 12.345678, "longitude": 98.765432, "name": "PRIVATE_NAME", "poiId": "PRIVATE_ID"}
        result = summarize_navigation([
            event("operator_route_selected", target=target), event("destination_info", payload=target)])
        self.assertTrue(all(result["observations"][1]["matches_last_test_target"].values()))
        text = json.dumps(result)
        for private in ["12.345678", "98.765432", "PRIVATE_NAME", "PRIVATE_ID"]:
            self.assertNotIn(private, text)


if __name__ == "__main__":
    unittest.main()
