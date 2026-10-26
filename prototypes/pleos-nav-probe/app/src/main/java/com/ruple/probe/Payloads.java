package com.ruple.probe;

import org.json.JSONException;
import org.json.JSONObject;

import ai.pleos.playground.navi.data.BookmarkInfo;
import ai.pleos.playground.navi.data.RecentDestinationInfo;

/** Public SDK getters only; observation time is recorded separately from place data. */
final class Payloads {
    private Payloads() {}

    static JSONObject bookmark(BookmarkInfo value) throws JSONException {
        return place(value.getLatitude(), value.getLongitude(), value.getDisplayLatitude(),
                value.getDisplayLongitude(), value.getName(), value.getAddress(),
                value.getPoiId(), value.getPoiSubId(), value.getPoiProvider())
                .put("category", nullable(value.getCategory()));
    }

    static JSONObject recent(RecentDestinationInfo value) throws JSONException {
        return place(value.getLatitude(), value.getLongitude(), value.getDisplayLatitude(),
                value.getDisplayLongitude(), value.getName(), value.getAddress(),
                value.getPoiId(), value.getPoiSubId(), value.getPoiProvider());
    }

    private static JSONObject place(double latitude, double longitude, Double displayLatitude,
            Double displayLongitude, String name, String address, String poiId,
            String poiSubId, String poiProvider) throws JSONException {
        return new JSONObject()
                .put("latitude", latitude).put("longitude", longitude)
                .put("displayLatitude", nullable(displayLatitude))
                .put("displayLongitude", nullable(displayLongitude))
                .put("name", nullable(name)).put("address", nullable(address))
                .put("poiId", nullable(poiId)).put("poiSubId", nullable(poiSubId))
                .put("poiProvider", nullable(poiProvider));
    }

    private static Object nullable(Object value) {
        return value == null ? JSONObject.NULL : value;
    }
}
