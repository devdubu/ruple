"""Host-side collector policy tests; these do not simulate successful SDK integration."""
import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from capture_probe import CaptureHealth, can_finish_capture, parse_snapshot
from summarize_probe import summarize


def event(kind, query=None, cycle=1, in_window=True):
    return {"event": kind, "kind": query, "cycle": cycle, "elapsed_ms": 0,
            "in_request_window": in_window}


class CapturePolicyTest(unittest.TestCase):
    def test_read_failures_after_a_good_snapshot_are_not_sdk_silence(self):
        health = CaptureHealth()
        health.success()
        for _ in range(3): health.failure("events_file", 1)
        self.assertTrue(health.must_stop())
        report = health.report("read_failure", [event("cycle_finished")])
        self.assertEqual(report["integrity"], "incomplete")
        self.assertIsNotNone(report["last_successful_read_at"])
        self.assertFalse(report["sdk_release_observed"])

    def test_capture_deadline_does_not_claim_sdk_release(self):
        health = CaptureHealth()
        health.success()
        report = health.report("observation_timeout", [])
        self.assertEqual(report["termination_reason"], "observation_timeout")
        self.assertFalse(report["sdk_release_observed"])

    def test_partial_record_is_not_published_as_a_complete_snapshot(self):
        with self.assertRaises(ValueError): parse_snapshot(b'{"event":"pending"')
        self.assertEqual(parse_snapshot(b'{"event":"complete"}\n')[0]["event"], "complete")

    def test_both_list_callbacks_and_cycle_end_allow_early_finish(self):
        self.assertTrue(can_finish_capture([
            event("list_received", "bookmark"), event("list_received", "recent"),
            event("cycle_finished")]))

    def test_failed_response_cannot_end_observation_early(self):
        for failure in ["null_payload", "request_exception", "payload_decode_failed"]:
            with self.subTest(failure=failure):
                self.assertFalse(can_finish_capture([
                    event("list_received", "bookmark"), event(failure, "recent"),
                    event("cycle_finished")]))

    def test_late_callback_does_not_turn_timeout_into_on_time_success(self):
        self.assertFalse(can_finish_capture([
            event("callback_not_observed", "bookmark"), event("list_received", "recent"),
            event("cycle_finished"), event("list_received", "bookmark", in_window=False)]))

    def test_previous_complete_cycle_does_not_complete_new_pending_cycle(self):
        self.assertFalse(can_finish_capture([
            event("list_received", "bookmark"), event("list_received", "recent"),
            event("cycle_finished"), event("cycle_started", cycle=2)]))

    def test_shareable_summary_excludes_place_values_and_raw_exception_message(self):
        data = event("list_received", "recent")
        data.update(count=1, items=[{"name": "PRIVATE_NAME", "latitude": 12.345678,
                                    "poiId": "PRIVATE_ID"}])
        error = event("request_exception", "bookmark")
        error["message"] = "PRIVATE_ERROR"
        encoded = json.dumps(summarize([data, error]))
        for private in ["PRIVATE_NAME", "12.345678", "PRIVATE_ID", "PRIVATE_ERROR"]:
            self.assertNotIn(private, encoded)
        self.assertIn('"count": 1', encoded)


if __name__ == "__main__":
    unittest.main()
