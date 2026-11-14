import assert from "node:assert/strict";
import { test } from "node:test";
import { matchUrbanPiperStore, parseUrbanPiperOrder, parseUrbanPiperStatus, sendUrbanPiperStatus } from "./urbanPiper";

test("parses the UrbanPiper order relay identifiers and preserves order details", () => {
  const result = parseUrbanPiperOrder({
    customer: { name: "Customer" },
    order: { details: { id: 123, biz_id: 456, channel: "swiggy", order_state: "Placed" }, store: { id: 789 }, items: [{ title: "Meal" }] },
  });
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.order.details.id, "123");
  assert.equal(result.data.order.details.biz_id, "456");
  assert.equal(result.data.order.store.id, "789");
  assert.deepEqual(result.data.order.items, [{ title: "Meal" }]);
});

test("rejects malformed or unsafe order identifiers", () => {
  assert.equal(parseUrbanPiperOrder({ order: { details: { id: Number.MAX_SAFE_INTEGER + 1, biz_id: 1, channel: "zomato", order_state: "Placed" }, store: { id: 2 }, items: [] } }).success, false);
  assert.equal(parseUrbanPiperOrder({ order: {} }).success, false);
  assert.equal(parseUrbanPiperOrder({ order: { details: { id: "..", biz_id: 1, channel: "zomato", order_state: "Placed" }, store: { id: 2 }, items: [] } }).success, false);
});

test("validates status events and authenticates a configured store", () => {
  const previous = process.env.URBANPIPER_STORES;
  const mapping = { restaurantId: "9b20ff3c-a643-42fd-9ca4-67f21f52bc5c", businessId: "456", storeId: "789", webhookSecret: "s".repeat(32) };
  process.env.URBANPIPER_STORES = JSON.stringify([mapping]);
  try {
    assert.equal(parseUrbanPiperStatus({ order_id: 123, store_upipr_id: 789, new_state: "Completed", timestamp_unix: 1700000000000 }).success, true);
    assert.equal(parseUrbanPiperStatus({ order_id: 123, store_upipr_id: 789, new_state: "Completed" }).success, false);
    assert.equal(matchUrbanPiperStore("456", "789", mapping.webhookSecret).restaurantId, mapping.restaurantId);
    assert.throws(() => matchUrbanPiperStore("456", "789", "incorrect"));
    assert.throws(() => matchUrbanPiperStore("456", "790", mapping.webhookSecret));
    process.env.URBANPIPER_STORES = JSON.stringify([mapping, mapping]);
    assert.throws(() => matchUrbanPiperStore("456", "789", mapping.webhookSecret));
    process.env.URBANPIPER_STORES = JSON.stringify([mapping, { ...mapping, storeId: "790", webhookSecret: "x".repeat(32) }]);
    assert.throws(() => matchUrbanPiperStore("456", "789", mapping.webhookSecret));
  } finally {
    if (previous === undefined) delete process.env.URBANPIPER_STORES; else process.env.URBANPIPER_STORES = previous;
  }
});

test("sends status updates with the documented authentication and rejects failures", async () => {
  const originalFetch = globalThis.fetch;
  const originalBase = process.env.URBANPIPER_API_BASE_URL;
  delete process.env.URBANPIPER_API_BASE_URL;
  const mapping = { restaurantId: "9b20ff3c-a643-42fd-9ca4-67f21f52bc5c", businessId: "456", storeId: "789", webhookSecret: "s".repeat(32), apiUsername: "user", apiKey: "key" };
  try {
    globalThis.fetch = async (input, init) => {
      assert.equal(String(input), "https://pos-int.urbanpiper.com/external/api/v1/orders/123/status/");
      assert.deepEqual(init?.headers, { Authorization: "apikey user:key", "X-UPR-Biz-Id": "456", "Content-Type": "application/json" });
      assert.deepEqual(JSON.parse(String(init?.body)), { new_status: "Acknowledged", extra: { prep_time_mins: 15 } });
      return Response.json({ status: "success" });
    };
    await sendUrbanPiperStatus(mapping, "123", "Acknowledged", 15);
    globalThis.fetch = async () => new Response(null, { status: 204 });
    await sendUrbanPiperStatus(mapping, "123", "Acknowledged");
    globalThis.fetch = async () => Response.json({ status: "error" }, { status: 400 });
    await assert.rejects(sendUrbanPiperStatus(mapping, "123", "Food Ready"));
    globalThis.fetch = async () => Response.json({ status: "error" });
    await assert.rejects(sendUrbanPiperStatus(mapping, "123", "Food Ready"));
    process.env.URBANPIPER_API_BASE_URL = "https://example.com";
    await assert.rejects(sendUrbanPiperStatus(mapping, "123", "Food Ready"));
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBase === undefined) delete process.env.URBANPIPER_API_BASE_URL; else process.env.URBANPIPER_API_BASE_URL = originalBase;
  }
});