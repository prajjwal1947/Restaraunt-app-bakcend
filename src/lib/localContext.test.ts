import assert from "node:assert/strict";
import { test } from "node:test";
import { activitySchema, distanceKm, locationSchema, parseWeather, selectLocalActivities, weatherLabel, type LocalActivityEvidence } from "./localContext";

const activity: LocalActivityEvidence = {
  id: "event", kind: "EVENT", scope: "nearby", title: "Local market", placeName: "Town square",
  startsOn: "2026-10-22", endsOn: "2026-10-24", latitude: 0.01, longitude: 0,
  sourceUrl: "https://example.com/market", source: "Owner recorded", recordedAt: "2026-10-20T00:00:00Z",
};
const location = { latitude: 0, longitude: 0, contextRadiusKm: 3 };

test("selects nearby places by coordinates and date overlap, including valid zero coordinates", () => {
  const selected = selectLocalActivities([activity, { ...activity, id: "far", latitude: 10 }], location, "2026-10-23", "2026-10-23");
  assert.equal(selected.length, 1);
  assert.ok(selected[0].distanceKm > 1 && selected[0].distanceKm < 2);
  assert.equal(selectLocalActivities([activity], location, "2026-10-25", "2026-10-26").length, 0);
  assert.equal(distanceKm(location, location), 0);
});

test("does not infer a nearby location when coordinates are missing; own activities remain usable", () => {
  const missingLocation = { ...location, latitude: null, longitude: null };
  assert.equal(selectLocalActivities([activity], missingLocation, "2026-10-23", "2026-10-23").length, 0);
  assert.equal(selectLocalActivities([{ ...activity, scope: "restaurant", latitude: null, longitude: null }], missingLocation, "2026-10-23", "2026-10-23").length, 1);
});

test("rejects invalid coordinates, unsafe source links, reversed dates and impossible calendar dates", () => {
  assert.equal(locationSchema.safeParse({ ...location, latitude: 91 }).success, false);
  assert.equal(locationSchema.safeParse({ ...location, longitude: null }).success, false);
  assert.equal(locationSchema.safeParse({ ...location, contextRadiusKm: 51 }).success, false);
  assert.equal(activitySchema.safeParse(activity).success, true);
  assert.equal(activitySchema.safeParse({ ...activity, sourceUrl: "javascript:alert(1)" }).success, false);
  assert.equal(activitySchema.safeParse({ ...activity, endsOn: "2026-10-01" }).success, false);
  assert.equal(activitySchema.safeParse({ ...activity, startsOn: "2026-02-30" }).success, false);
  assert.equal(activitySchema.safeParse({ ...activity, latitude: null, longitude: null }).success, false);
});

test("weather keeps missing values unknown and distinguishes modeled past weather from forecasts", () => {
  const days = parseWeather({ daily: {
    time: ["2026-10-22", "2026-10-24"], temperature_2m_max: [null, 28], precipitation_sum: [0, 4], weather_code: [null, 63],
  } }, "2026-10-23");
  assert.equal(days[0].maxTemperatureC, null);
  assert.equal(days[0].precipitationMm, 0);
  assert.equal(days[0].evidence, "past-model-estimate");
  assert.equal(days[1].evidence, "forecast");
  assert.equal(weatherLabel(days[1].weatherCode), "Rain");
  assert.throws(() => parseWeather({ daily: { time: ["2026-10-22"], temperature_2m_max: [], precipitation_sum: [], weather_code: [] } }, "2026-10-23"));
});