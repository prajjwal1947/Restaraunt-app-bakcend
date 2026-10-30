import assert from "node:assert/strict";
import { test } from "node:test";
import { computeRestaurantIntelligence } from "./restaurantIntelligence";

const product = (id = "biryani", createdAt = "2026-01-01T00:00:00Z") => ({
  id, name: id, isAvailable: true, createdAt: new Date(createdAt),
});
const order = (date: string, quantity: number, overrides: Record<string, unknown> = {}) => ({
  createdAt: new Date(date), totalMinor: quantity * 10000, rating: 5,
  status: "SERVED",
  items: [{ menuItemId: "biryani", nameSnapshot: "Biryani", quantity, lineTotalMinor: quantity * 10000, rating: 4 }],
  ...overrides,
});
const input = {
  restaurantName: "Test restaurant", currency: "INR", timezone: "UTC",
  now: new Date("2026-10-25T12:00:00Z"), menuItems: [product()], orders: [],
};

test("forecasts from six matching weekdays, exposing history rather than claiming a prediction interval", () => {
  const dates = ["2026-10-19", "2026-10-12", "2026-10-05", "2026-09-28", "2026-09-21", "2026-09-14"];
  const result = computeRestaurantIntelligence({
    ...input, orders: dates.map((date, index) => order(`${date}T12:00:00Z`, 60 + index)),
  });
  assert.equal(result.prepForecast[0].sampleDays, 6);
  assert.equal(result.prepForecast[0].averageQuantity, 62.5);
  assert.equal(result.prepForecast[0].recommendedQuantity, 63);
  assert.equal(result.prepForecast[0].historicalLow, 60);
  assert.equal(result.prepForecast[0].historicalHigh, 65);
});

test("does not recommend quantities from insufficient history or count closed days as zero", () => {
  const result = computeRestaurantIntelligence({ ...input, orders: [order("2026-10-19T12:00:00Z", 60)] });
  assert.equal(result.prepForecast[0].sampleDays, 1);
  assert.equal(result.prepForecast[0].recommendedQuantity, null);
  assert.equal(result.prepForecast[0].evidence, "insufficient-history");
});

test("counts zero product sales on observed trading days but excludes dates before introduction", () => {
  const orders = ["2026-10-19", "2026-10-12", "2026-10-05", "2026-09-28"].map((date) => order(`${date}T12:00:00Z`, 10));
  const result = computeRestaurantIntelligence({
    ...input, menuItems: [product(), product("new", "2026-10-01T00:00:00Z")], orders,
  });
  const forecast = result.prepForecast.find((item) => item.itemId === "new")!;
  assert.equal(forecast.sampleDays, 3);
  assert.equal(forecast.recommendedQuantity, 0);
  assert.ok(!result.leastOrdered.some((item) => item.id === "new"));
});

test("separates the last seven complete days from the preceding seven days", () => {
  const result = computeRestaurantIntelligence({
    ...input,
    orders: [order("2026-10-19T12:00:00Z", 20), order("2026-10-12T12:00:00Z", 10), order("2026-10-25T10:00:00Z", 200)],
  });
  assert.equal(result.bestSellers[0].units7, 20);
  assert.equal(result.bestSellers[0].previousUnits7, 10);
  assert.equal(result.bestSellers[0].changePercent, 100);
  assert.equal(result.sales.revenue7Minor, 200000);
  assert.equal(result.sales.previousRevenue7Minor, 100000);
});

test("respects restaurant timezone boundaries and excludes cancelled and future orders", () => {
  const result = computeRestaurantIntelligence({
    ...input, timezone: "Asia/Kolkata", now: new Date("2026-10-25T01:00:00Z"),
    orders: [
      order("2026-10-24T18:00:00Z", 3),
      order("2026-10-24T20:00:00Z", 100),
      order("2026-10-24T12:00:00Z", 200, { status: "CANCELLED" }),
      order("2026-10-26T12:00:00Z", 300),
    ],
  });
  assert.equal(result.bestSellers[0].units7, 3);
  assert.equal(result.sales.yesterday.revenueMinor, 30000);
});

test("aggregates ratings by review count, not quantities, and requires evidence for promotions", () => {
  const result = computeRestaurantIntelligence({
    ...input,
    orders: [order("2026-10-20T12:00:00Z", 100), order("2026-10-21T12:00:00Z", 1), order("2026-10-22T12:00:00Z", 1)],
  });
  assert.equal(result.reviews.ratingCount, 3);
  assert.equal(result.reviews.products[0].ratingCount, 3);
  assert.equal(result.reviews.products[0].averageRating, 4);
  assert.equal(result.promotionCandidates[0].id, "biryani");
});

test("reports demand declines as waste-risk signals and compares yesterday with the same weekday", () => {
  const result = computeRestaurantIntelligence({
    ...input, orders: [order("2026-10-24T12:00:00Z", 5), order("2026-10-17T12:00:00Z", 10)],
  });
  assert.equal(result.demandWarnings[0].changePercent, -50);
  assert.equal(result.sales.yesterday.comparisonDate, "2026-10-17");
  assert.equal(result.sales.yesterday.productDeclines[0].revenueDifferenceMinor, -50000);
});

test("represents missing data as unknown and adapts to newly recorded orders", () => {
  const empty = computeRestaurantIntelligence(input);
  assert.equal(empty.reviews.averageRating, null);
  assert.equal(empty.sales.changePercent, null);
  assert.equal(empty.prepForecast[0].recommendedQuantity, null);
  assert.deepEqual(empty.bestSellers, []);
  const updated = computeRestaurantIntelligence({ ...input, orders: [order("2026-10-24T12:00:00Z", 5)] });
  assert.equal(updated.bestSellers[0].units7, 5);
  assert.ok(updated.limitations.some((limitation) => limitation.includes("customer identities")));
});