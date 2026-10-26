package com.ruple.probe;

import android.app.Activity;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import ai.pleos.playground.navi.constants.NaviErrorCode;
import ai.pleos.playground.navi.data.BookmarkInfo;
import ai.pleos.playground.navi.data.RecentDestinationInfo;
import ai.pleos.playground.navi.helper.NaviHelper;
import ai.pleos.playground.navi.helper.listener.NaviHelperEventListener;
import kotlin.Unit;

public final class MainActivity extends Activity {
    private static final long OBSERVATION_MS = 30_000;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final String session = UUID.randomUUID().toString();
    private NaviHelper helper;
    private File eventFile;
    private TextView output;
    private TextView summary;
    private String connectionSummary = "연결 대기";
    private String bookmarkSummary = "미조회";
    private String recentSummary = "미조회";
    private Button query;
    private boolean destroyed;
    private boolean connected;
    private boolean connectionResultObserved;
    private boolean registered;
    private String pending;
    private int cycle;
    private int requestGeneration;

    private final NaviHelperEventListener listener = new NaviHelperEventListener() {
        @Override public void onBookmarkInfo(List<BookmarkInfo> values) {
            main.post(() -> receive("bookmark", values));
        }
        @Override public void onRecentDestinationInfo(List<RecentDestinationInfo> values) {
            main.post(() -> receive("recent", values));
        }
        @Override public void onBookMarkChanged() {
            main.post(() -> { if (!destroyed) event("bookmark_changed", details()); });
        }
        @Override public void onError(NaviErrorCode code) {
            main.post(() -> {
                if (!destroyed) event("sdk_error", details("error", String.valueOf(code),
                        "pending_at_event", pending));
                // The SDK error does not carry our request ID. Keep observing the list callback.
            });
        }
    };

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(24, 12, 24, 12);
        TextView title = new TextView(this);
        title.setText("루플레 · Pleos 실제 SDK 데이터 조회\n즐겨찾기 / 최근 목적지 · 시험 자료 대체 없음");
        title.setTextSize(20);
        layout.addView(title);
        summary = new TextView(this);
        summary.setTextSize(18);
        layout.addView(summary);
        query = new Button(this);
        query.setText("두 항목 다시 조회");
        query.setEnabled(false);
        query.setOnClickListener(v -> startCycle());
        layout.addView(query);
        ScrollView scroll = new ScrollView(this);
        output = new TextView(this);
        output.setTextIsSelectable(true);
        output.setTextSize(13);
        scroll.addView(output);
        layout.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));
        setContentView(layout);
        eventFile = new File(getNoBackupFilesDir(), "probe-" + session + ".jsonl");
        try (FileOutputStream latest = new FileOutputStream(new File(getNoBackupFilesDir(), "latest-session.txt"))) {
            latest.write(eventFile.getName().getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new IllegalStateException("Cannot create probe log", e);
        }
        event("app_started", details("sdk", BuildConfig.NAVI_HELPER_VERSION,
                "android_api", Build.VERSION.SDK_INT, "fingerprint", Build.FINGERPRINT,
                "model", Build.MODEL, "observation_ms", OBSERVATION_MS));
        helper = new NaviHelper(getApplicationContext());
        event("connection_started", details());
        main.postDelayed(() -> {
            if (!connectionResultObserved && !destroyed) event("connection_not_observed", details());
        }, OBSERVATION_MS);
        try {
            helper.initialize(() -> {
                main.post(() -> {
                    if (destroyed) return;
                    connectionResultObserved = true;
                    connected = true;
                    event("service_connected", details());
                    try {
                        helper.addListener(listener);
                        registered = true;
                        event("listener_registered", details());
                        startCycle();
                    } catch (Exception e) {
                        event("listener_registration_failed", error(e));
                    }
                });
                return Unit.INSTANCE;
            }, throwable -> {
                main.post(() -> {
                    if (!destroyed) {
                        connectionResultObserved = true;
                        event("connection_failed", error(throwable));
                    }
                });
                return Unit.INSTANCE;
            });
        } catch (Exception e) {
            connectionResultObserved = true;
            event("initialization_exception", error(e));
        }
    }

    private void startCycle() {
        if (!connected || !registered || pending != null || destroyed) return;
        query.setEnabled(false);
        cycle++;
        event("cycle_started", details());
        request("bookmark");
    }

    private void request(String kind) {
        pending = kind;
        int generation = ++requestGeneration;
        event("request_sent", details("kind", kind));
        main.postDelayed(() -> {
            if (!destroyed && generation == requestGeneration && kind.equals(pending)) {
                event("callback_not_observed", details("kind", kind,
                        "observation_ms", OBSERVATION_MS));
                advance(kind);
            }
        }, OBSERVATION_MS);
        try {
            if (kind.equals("bookmark")) helper.getBookmarkInfo();
            else helper.getRecentDestinationInfo();
            event("request_returned", details("kind", kind));
        } catch (Exception e) {
            event("request_exception", details("kind", kind,
                    "error_class", e.getClass().getName(), "message", e.getMessage()));
            advance(kind);
        }
    }

    private void receive(String kind, List<?> values) {
        if (destroyed) return;
        boolean inWindow = kind.equals(pending);
        JSONArray rows = new JSONArray();
        try {
            if (values != null) for (Object value : values) {
                rows.put(value == null ? JSONObject.NULL : kind.equals("bookmark")
                        ? Payloads.bookmark((BookmarkInfo) value)
                        : Payloads.recent((RecentDestinationInfo) value));
            }
            event(values == null ? "null_payload" : "list_received", details("kind", kind,
                    "in_request_window", inWindow,
                    "count", values == null ? null : values.size(), "items", rows));
        } catch (Exception e) {
            event("payload_decode_failed", details("kind", kind,
                    "error_class", e.getClass().getName(), "message", e.getMessage()));
        }
        if (inWindow) advance(kind);
    }

    private void advance(String kind) {
        pending = null;
        requestGeneration++;
        if (kind.equals("bookmark")) main.post(() -> { if (!destroyed) request("recent"); });
        else {
            event("cycle_finished", details());
            query.setEnabled(true);
        }
    }

    private void event(String type, JSONObject data) {
        try {
            data.put("event", type).put("session_id", session).put("cycle", cycle)
                    .put("source", "pleos_sdk").put("observed_at", Instant.now().toString())
                    .put("elapsed_ms", SystemClock.elapsedRealtime());
            try (FileOutputStream file = new FileOutputStream(eventFile, true)) {
                file.write((data + "\n").getBytes(StandardCharsets.UTF_8));
            }
            updateSummary(type, data);
            output.append(data.toString(2) + "\n\n");
            Log.i("RupleProbe", type); // Raw locations stay in the app-private file and UI.
        } catch (Exception e) {
            output.append("기록 실패: " + e.getClass().getName() + "\n");
            Log.e("RupleProbe", "Cannot persist observation", e);
        }
    }

    private void updateSummary(String type, JSONObject data) {
        if (type.equals("service_connected")) connectionSummary = "연결됨";
        if (type.equals("connection_failed") || type.equals("initialization_exception"))
            connectionSummary = "연결 실패";
        if (type.equals("connection_not_observed")) connectionSummary = "연결 결과 미수신";
        if (type.equals("listener_registration_failed")) connectionSummary = "리스너 등록 실패";
        String result = switch (type) {
            case "request_sent" -> "응답 대기";
            case "list_received" -> data.optInt("count") + "개 항목 수신";
            case "null_payload" -> "null 응답";
            case "callback_not_observed" -> "30초 내 미수신";
            case "request_exception" -> "요청 예외";
            case "payload_decode_failed" -> "응답 처리 오류";
            default -> null;
        };
        if (result != null) {
            if (data.optString("kind").equals("bookmark")) bookmarkSummary = result;
            if (data.optString("kind").equals("recent")) recentSummary = result;
        }
        summary.setText("SDK " + connectionSummary + " · 즐겨찾기 " + bookmarkSummary
                + " · 최근 목적지 " + recentSummary);
    }

    private static JSONObject details(Object... entries) {
        JSONObject result = new JSONObject();
        try {
            for (int i = 0; i < entries.length; i += 2)
                result.put((String) entries[i], entries[i + 1] == null ? JSONObject.NULL : entries[i + 1]);
            return result;
        } catch (JSONException e) { throw new IllegalArgumentException(e); }
    }

    private static JSONObject error(Throwable e) {
        return details("error_class", e.getClass().getName(), "message", e.getMessage());
    }

    @Override public void onDestroy() {
        destroyed = true;
        main.removeCallbacksAndMessages(null);
        if (helper != null) {
            try {
                if (registered) helper.removeListener(listener);
                helper.release();
                event("sdk_released", details());
            } catch (Exception e) { event("release_failed", error(e)); }
        }
        super.onDestroy();
    }
}
