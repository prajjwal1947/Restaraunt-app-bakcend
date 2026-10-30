import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchLocalWeather, fetchNearbyEvents } from "./localContextProviders";

const location = { latitude: 0, longitude: 0, contextRadiusKm: 3, timezone: "UTC" };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const mockFetch = (handler: (input: Parameters<typeof fetch>[0]) => Response) => (async (input) => handler(input)) as typeof fetch;

test("weather requests coordinates/timezone and keeps past estimates distinguishable", async () => {
  const result = await fetchLocalWeather(location, "2026-10-23", mockFetch((input) => {
    const url = new URL(String(input));
    assert.equal(url.searchParams.get("timezone"), "UTC");
    assert.equal(url.searchParams.get("past_days"), "8");
    assert.equal(url.searchParams.get("latitude"), "0");
    return response({ daily: { time: ["2026-10-22"], temperature_2m_max: [25], precipitation_sum: [5], weather_code: [63] } });
  }));
  assert.equal(result.status, "ready");
  assert.equal(result.data[0].evidence, "past-model-estimate");
});

test("does not call an event provider without its key", async () => {
  const result = await fetchNearbyEvents(location, "2026-10-22", "2026-10-24", "", mockFetch(() => { throw new Error("Must not call"); }));
  assert.equal(result.status, "not-configured");
});

test("event discovery applies radius, date, cancellation and coordinate checks", async () => {
  const event = { id: "near", name: "Local show", url: "https://www.ticketmaster.com/example", dates: { start: { localDate: "2026-10-23" }, status: { code: "onsale" } }, _embedded: { venues: [{ name: "Square", location: { latitude: "0.01", longitude: "0" } }] } };
  const result = await fetchNearbyEvents(location, "2026-10-22", "2026-10-24", "test-key", mockFetch((input) => {
    const url = new URL(String(input));
    assert.ok(url.searchParams.get("geoPoint"));
    assert.equal(url.searchParams.get("radius"), "3");
    return response({ _embedded: { events: [
      event,
      { ...event, id: "cancelled", dates: { ...event.dates, status: { code: "cancelled" } } },
      { ...event, id: "old", dates: { start: { localDate: "2026-10-01" } } },
      { ...event, id: "far", _embedded: { venues: [{ name: "Far", location: { latitude: "10", longitude: "0" } }] } },
      { ...event, id: "invalid", url: "javascript:alert(1)" },
    ] } });
  }));
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].source, "Ticketmaster");
  assert.ok(result.message.includes("no listings does not mean no events"));
});

test("provider outages are errors, not empty successful data", async () => {
  await assert.rejects(fetchLocalWeather(location, "2026-10-23", mockFetch(() => response({}, 503))), /HTTP 503/);
  await assert.rejects(fetchNearbyEvents(location, "2026-10-22", "2026-10-24", "test", mockFetch(() => response({}, 401))), /HTTP 401/);
});