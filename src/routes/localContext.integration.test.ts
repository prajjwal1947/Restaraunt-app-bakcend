import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { test } from "node:test";
import jwt from "jsonwebtoken";
import { app } from "../app";
import { prisma } from "../lib/prisma";

test("local context CRUD, tenant isolation, permissions, provider caching and grounded fallback", async () => {
  const originalFetch = globalThis.fetch;
  const geminiKey = process.env.GEMINI_API_KEY;
  const eventsKey = process.env.TICKETMASTER_API_KEY;
  delete process.env.GEMINI_API_KEY;
  process.env.TICKETMASTER_API_KEY = "integration-fixture";
  const today = new Date().toISOString().slice(0, 10);
  const shift = (offset: number) => new Date(new Date(`${today}T00:00:00Z`).getTime() + offset * 86400000).toISOString().slice(0, 10);
  let weatherCalls = 0;
  let eventCalls = 0;
  globalThis.fetch = async (input, options) => {
    const url = String(input);
    if (url.includes("open-meteo.com/")) {
      weatherCalls += 1;
      return Response.json({ daily: {
        time: [shift(-8), shift(-1), today, shift(1)], temperature_2m_max: [25, 22, 24, 25],
        precipitation_sum: [0, 20, 4, 1], weather_code: [0, 63, 63, 2],
      } });
    }
    if (url.includes("app.ticketmaster.com/")) {
      eventCalls += 1;
      return Response.json({ _embedded: { events: [{ id: "fixture", name: "Provider event", url: "https://www.ticketmaster.com/fixture",
        dates: { start: { localDate: today } }, _embedded: { venues: [{ name: "Nearby hall", location: { latitude: "51.501", longitude: "-0.12" } }] },
      }] } });
    }
    return originalFetch(input, options);
  };
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  let restaurantId: string | undefined;
  try {
    const restaurant = await prisma.restaurant.create({ data: {
      name: "Temporary context integration test", email: `context-${randomUUID()}@example.invalid`, timezone: "UTC",
      users: { create: { name: "Test owner", email: "test@example.invalid", passwordHash: "not-a-login-password", role: "OWNER" } },
    }, include: { users: true } });
    restaurantId = restaurant.id;
    const token = (role = "OWNER", tenantId = restaurant.id) => jwt.sign({ restaurantId: tenantId, role, type: "access" }, process.env.JWT_ACCESS_SECRET ?? "development-access-secret", { subject: restaurant.users[0].id, expiresIn: "2m" });
    const request = async (path: string, method = "GET", body?: unknown, accessToken = token()) => {
      const response = await originalFetch(`http://127.0.0.1:${address.port}/api/v1${path}`, {
        method, headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: response.status, body: response.status === 204 ? null : await response.json() };
    };
    const prefix = "/dashboard/insights";
    const unconfigured = await request(`${prefix}/summary`);
    assert.equal(unconfigured.status, 200);
    assert.equal(unconfigured.body.data.localContext.weather.status, "location-required");
    assert.equal(weatherCalls, 0);
    assert.equal((await request("/restaurant", "PATCH", { latitude: 91, longitude: 0 })).status, 422);
    assert.equal((await request("/restaurant", "PATCH", { latitude: 51.5, longitude: -0.12, contextRadiusKm: 3 })).status, 200);
    const activity = { kind: "PROMOTION", scope: "nearby", title: "Neighbor lunch offer", placeName: "Neighbor cafe", startsOn: shift(-1), endsOn: today, latitude: 51.501, longitude: -0.12, sourceUrl: "https://example.com/offer" };
    assert.equal((await request(`${prefix}/local-activities`, "POST", activity, token("STAFF"))).status, 403);
    assert.equal((await request(`${prefix}/local-activities`, "POST", { ...activity, sourceUrl: "javascript:alert(1)" })).status, 422);
    const created = await request(`${prefix}/local-activities`, "POST", activity);
    assert.equal(created.status, 201);
    const activityId = created.body.data.id;
    assert.equal((await request(`${prefix}/local-activities/${activityId}`, "PATCH", { ...activity, title: "Updated neighbor lunch offer" })).status, 200);
    assert.equal((await request(`${prefix}/local-activities/${activityId}`, "DELETE", undefined, token("OWNER", randomUUID()))).status, 404);
    const foreignList = await request(`${prefix}/local-activities`, "GET", undefined, token("OWNER", randomUUID()));
    assert.deepEqual(foreignList.body.data, []);
    const far = await request(`${prefix}/local-activities`, "POST", { ...activity, title: "Far activity", latitude: 52.5 });
    assert.equal(far.status, 201);
    const summary = await request(`${prefix}/summary`);
    assert.equal(summary.status, 200);
    const context = summary.body.data.localContext;
    assert.equal(context.weather.status, "ready");
    assert.equal(context.activities.length, 2);
    assert.ok(context.activities.some((item: { source: string }) => item.source === "Ticketmaster"));
    assert.ok(!context.activities.some((item: { title: string }) => item.title === "Far activity"));
    await request(`${prefix}/summary`);
    assert.equal(weatherCalls, 1);
    assert.equal(eventCalls, 1);
    const answer = await request(prefix, "POST", { question: "Why did sales fall yesterday?" });
    assert.equal(answer.status, 200);
    assert.equal(answer.body.data.mode, "local");
    assert.match(answer.body.data.answer, /Open-Meteo/);
    assert.match(answer.body.data.answer, /Updated neighbor lunch offer/);
    assert.match(answer.body.data.answer, /not demonstrated causes/);
    assert.equal((await request(`${prefix}/local-activities/${activityId}`, "DELETE")).status, 204);
  } finally {
    globalThis.fetch = originalFetch;
    if (geminiKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = geminiKey;
    if (eventsKey === undefined) delete process.env.TICKETMASTER_API_KEY; else process.env.TICKETMASTER_API_KEY = eventsKey;
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (restaurantId) await prisma.restaurant.delete({ where: { id: restaurantId } });
    await prisma.$disconnect();
  }
});