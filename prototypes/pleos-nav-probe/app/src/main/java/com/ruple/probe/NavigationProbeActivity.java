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

import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import ai.pleos.playground.navi.constants.NaviErrorCode;
import ai.pleos.playground.navi.constants.NavigationStatus;
import ai.pleos.playground.navi.constants.RouteOption;
import ai.pleos.playground.navi.data.CurrentLocationInfo;
import ai.pleos.playground.navi.data.DestinationArrivedInfo;
import ai.pleos.playground.navi.data.DestinationInfo;
import ai.pleos.playground.navi.data.NavigationScreenRequest;
import ai.pleos.playground.navi.data.RouteInfo;
import ai.pleos.playground.navi.data.RouteStartInfo;
import ai.pleos.playground.navi.data.RouteStateInfo;
import ai.pleos.playground.navi.helper.NaviHelper;
import ai.pleos.playground.navi.helper.listener.NaviHelperEventListener;
import kotlin.Unit;

/** Development-only, operator-triggered navigation probe. No auto route on launch. */
public final class NavigationProbeActivity extends Activity {
    private final Handler main = new Handler(Looper.getMainLooper());
    private final String session = UUID.randomUUID().toString();
    private final List<Button> buttons = new ArrayList<>();
    private NaviHelper helper;
    private File eventFile;
    private TextView output;
    private TextView status;
    private boolean destroyed;
    private boolean registered;
    private boolean connected;
    private int attempt;
    private String phase = "baseline";
    private final boolean emulator = BuildConfig.DEBUG && "ranchu".equals(Build.HARDWARE)
            && "crp_avd_arm64".equals(Build.PRODUCT);

    private final NaviHelperEventListener listener = new NaviHelperEventListener() {
        @Override public void onRouteStarted(RouteStartInfo value) {
            post("route_started", fields("payload", fields("duration", value.getDuration(),
                    "distance", value.getDistance(), "tollFare", value.getTollFare(),
                    "name", value.getName(),
                    "remainDestinationChargingValue", value.getRemainDestinationChargingValue())));
        }
        @Override public void onRoutingCompleted() {
            main.post(() -> {
                if (destroyed) return;
                record("routing_completed", fields());
                queryContext();
            });
        }
        @Override public void onRouteEnded() { post("route_ended", fields()); }
        @Override public void onReRouteEnded() { post("reroute_ended", fields()); }
        @Override public void onRouteOptionChanged(RouteOption option) {
            post("route_option_changed", fields("option", String.valueOf(option)));
        }
        @Override public void onDestinationChanged() {
            post("destination_changed", fields());
        }
        @Override public void onRouteCancelled() {
            main.post(() -> {
                if (destroyed) return;
                record("route_cancelled", fields());
                queryContext();
            });
        }
        @Override public void onNavigationStatus(NavigationStatus value) {
            post("navigation_status", fields("status", String.valueOf(value)));
        }
        @Override public void onDestinationInfo(DestinationInfo value) {
            post("destination_info", fields("payload", fields("latitude", value.getLatitude(),
                    "longitude", value.getLongitude(), "displayLatitude", value.getDisplayLatitude(),
                    "displayLongitude", value.getDisplayLongitude(), "name", value.getName(),
                    "address", value.getAddress(), "remainDistance", value.getRemainDistance(),
                    "remainTime", value.getRemainTime(), "tollFare", value.getTollFare(),
                    "poiId", value.getPoiId(), "poiSubId", value.getPoiSubId(),
                    "poiProvider", value.getPoiProvider())));
        }
        @Override public void onRouteStateInfo(RouteStateInfo value) {
            post("route_state_info", fields("payload", fields("termsAgreement", value.getTermsAgreement(),
                    "naviMode", String.valueOf(value.getNaviMode()), "isRouting", value.isRouting(),
                    "routeOption", String.valueOf(value.getRouteOption()),
                    "remainDestinationChargingInt", value.getRemainDestinationChargingInt(),
                    "remainWaypointChargingInt", value.getRemainWaypointChargingInt(),
                    "trafficStatusRaw", String.valueOf(value.getTrafficStatus()))));
        }
        @Override public void onCurrentLocationInfo(CurrentLocationInfo value) {
            post("current_location_info", fields("payload", fields("latitude", value.getLatitude(),
                    "longitude", value.getLongitude(), "heading", value.getHeading(),
                    "address", value.getAddress(), "routeId", value.getRouteId(),
                    "currentRouteIndex", value.getCurrentRouteIndex())));
        }
        @Override public void onDestinationArrived(DestinationArrivedInfo value) {
            post("destination_arrived", fields("payload", fields("duration", value.getDuration(),
                    "distance", value.getDistance(), "name", value.getName(), "address", value.getAddress())));
        }
        @Override public void onError(NaviErrorCode code) {
            post("sdk_error", fields("error", String.valueOf(code)));
        }
    };

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        eventFile = new File(getNoBackupFilesDir(), "navprobe-" + session + ".jsonl");
        try (FileOutputStream file = new FileOutputStream(new File(getNoBackupFilesDir(), "latest-navigation-session.txt"))) {
            file.write(eventFile.getName().getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) { throw new IllegalStateException("Cannot create navigation log", e); }
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(20, 8, 20, 8);
        TextView title = new TextView(this);
        title.setText("루플레 · 에뮬레이터 내비 실행 검증\n42dot 공개 예제 · 버튼 선택 시에만 경로 변경");
        title.setTextSize(19);
        layout.addView(title);
        status = new TextView(this);
        status.setTextSize(17);
        layout.addView(status);
        LinearLayout actions = new LinearLayout(this);
        addButton(actions, "상태 조회", "ruple_nav_context", this::queryContext);
        addButton(actions, "42dot 경로 요청", "ruple_nav_route", this::requestTestRoute);
        addButton(actions, "내비 화면", "ruple_nav_screen", this::requestScreen);
        addButton(actions, "시험 경로 취소", "ruple_nav_cancel", this::cancelTestRoute);
        layout.addView(actions);
        Button finish = new Button(this);
        finish.setText("관찰 종료·SDK 해제");
        finish.setContentDescription("ruple_nav_finish");
        finish.setOnClickListener(v -> {
            record("navigation_observation_finished", fields());
            finish();
        });
        layout.addView(finish);
        output = new TextView(this);
        output.setTextSize(12);
        output.setTextIsSelectable(true);
        ScrollView scroll = new ScrollView(this);
        scroll.addView(output);
        layout.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));
        setContentView(layout);
        record("navigation_app_started", fields("sdk", BuildConfig.NAVI_HELPER_VERSION,
                "app_version", BuildConfig.VERSION_NAME, "emulator_guard", emulator,
                "fingerprint", Build.FINGERPRINT, "hardware", Build.HARDWARE,
                "product", Build.PRODUCT, "android_api", Build.VERSION.SDK_INT));
        if (!emulator) { record("emulator_guard_blocked", fields()); return; }
        helper = new NaviHelper(getApplicationContext());
        try {
            helper.initialize(() -> {
                main.post(() -> {
                    if (destroyed) return;
                    connected = true;
                    record("service_connected", fields());
                    try {
                        helper.addListener(listener);
                        registered = true;
                        for (Button b : buttons) b.setEnabled(true);
                        queryContext();
                    } catch (Exception e) { record("listener_registration_failed", failure(e)); }
                });
                return Unit.INSTANCE;
            }, e -> { post("connection_failed", failure(e)); return Unit.INSTANCE; });
        } catch (Exception e) { record("initialization_exception", failure(e)); }
    }

    private void addButton(LinearLayout row, String text, String description, Runnable action) {
        Button button = new Button(this);
        button.setText(text);
        button.setContentDescription(description);
        button.setEnabled(false);
        button.setOnClickListener(v -> { if (emulator && connected && !destroyed) action.run(); });
        row.addView(button, new LinearLayout.LayoutParams(0, -2, 1));
        buttons.add(button);
    }

    private void requestTestRoute() {
        RouteInfo route = new RouteInfo(37.48544722, 127.03636666, null, null,
                "42dot", "36khp37hh8gqcm5nqhe5", "서울시 강남구 남부순환로 2621", "0",
                RouteOption.RECOMMENDED, "", false);
        // Public getters validate the currently installed constructor's argument order.
        if (route.getLatitude() != 37.48544722 || route.getLongitude() != 127.03636666
                || !"42dot".equals(route.getPoiName())
                || !"36khp37hh8gqcm5nqhe5".equals(route.getPoiId())
                || !"서울시 강남구 남부순환로 2621".equals(route.getAddress())
                || !"0".equals(route.getPoiSubId())
                || route.getRouteOption() != RouteOption.RECOMMENDED) {
            record("route_arguments_invalid", fields()); return;
        }
        attempt++;
        phase = "route_request";
        record("operator_route_selected", fields("target_source", "official_destination_guide_public_example",
                "target", fields("latitude", route.getLatitude(), "longitude", route.getLongitude(),
                        "name", route.getPoiName(), "poiId", route.getPoiId(), "address", route.getAddress())));
        invoke("requestRoute", () -> helper.requestRoute(route));
    }

    private void requestScreen() {
        record("operator_screen_selected", fields());
        invoke("requestNavigationScreen.Foreground",
                () -> helper.requestNavigationScreen(NavigationScreenRequest.Foreground.INSTANCE));
    }

    private void cancelTestRoute() {
        phase = "cancel_request";
        record("operator_cancel_selected", fields());
        invoke("cancelRoute", () -> helper.cancelRoute());
    }

    private void queryContext() {
        if (!connected || destroyed) return;
        invoke("getDestinationInfo", () -> helper.getDestinationInfo());
        invoke("getRouteStateInfo", () -> helper.getRouteStateInfo());
        invoke("getCurrentLocationInfo", () -> helper.getCurrentLocationInfo());
    }

    private void invoke(String api, Runnable request) {
        record("api_called", fields("api", api));
        try { request.run(); record("api_returned", fields("api", api)); }
        catch (Exception e) { record("api_exception", fields("api", api,
                "error_class", e.getClass().getName(), "message", e.getMessage())); }
    }

    private void post(String type, JSONObject data) {
        main.post(() -> { if (!destroyed) record(type, data); });
    }

    private void record(String type, JSONObject data) {
        try {
            data.put("event", type).put("session_id", session).put("source", sourceFor(type))
                    .put("observed_at", Instant.now().toString()).put("elapsed_ms", SystemClock.elapsedRealtime())
                    .put("attempt_at_event", attempt).put("phase_at_event", phase);
            try (FileOutputStream file = new FileOutputStream(eventFile, true)) {
                file.write((data + "\n").getBytes(StandardCharsets.UTF_8));
            }
            if (output.length() > 160_000) output.setText("화면 일부 생략 · 원본 파일은 유지\n");
            output.append(data.toString(2) + "\n\n");
            status.setText("SDK " + (connected ? "연결됨" : "대기") + " · 단계 " + phase + " · 최근 " + type);
            Log.i("RupleNavProbe", type);
        } catch (Exception e) { Log.e("RupleNavProbe", "Cannot persist navigation observation", e); }
    }

    private static String sourceFor(String type) {
        if (type.startsWith("operator_")) return "operator_test_action";
        if (type.startsWith("api_")) return "app_sdk_invocation";
        return switch (type) {
            case "service_connected", "connection_failed", "route_started", "routing_completed",
                 "destination_changed", "route_cancelled", "navigation_status", "destination_info",
                 "route_state_info", "current_location_info", "destination_arrived", "sdk_error",
                 "route_ended", "reroute_ended", "route_option_changed"
                    -> "pleos_sdk_callback";
            default -> "probe_lifecycle";
        };
    }

    private static JSONObject fields(Object... values) {
        JSONObject result = new JSONObject();
        try {
            for (int i = 0; i < values.length; i += 2)
                result.put((String) values[i], values[i + 1] == null ? JSONObject.NULL : values[i + 1]);
            return result;
        } catch (JSONException e) { throw new IllegalArgumentException(e); }
    }

    private static JSONObject failure(Throwable e) {
        return fields("error_class", e.getClass().getName(), "message", e.getMessage());
    }

    @Override public void onPause() { super.onPause(); if (eventFile != null) record("activity_paused", fields()); }
    @Override public void onResume() { super.onResume(); if (eventFile != null) record("activity_resumed", fields()); }

    @Override public void onDestroy() {
        destroyed = true;
        main.removeCallbacksAndMessages(null);
        if (helper != null) {
            try { if (registered) helper.removeListener(listener); }
            catch (Exception e) { record("listener_remove_failed", failure(e)); }
            try { helper.release(); record("sdk_released", fields()); }
            catch (Exception e) { record("release_failed", failure(e)); }
        }
        super.onDestroy();
    }
}
