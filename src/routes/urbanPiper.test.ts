import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { test } from "node:test";
import jwt from "jsonwebtoken";
import { app } from "../app";
import { prisma } from "../lib/prisma";

test("webhooks deduplicate orders, isolate tenants and ignore stale status events", async () => {
  const previous = process.env.URBANPIPER_STORES;
  const restaurantId = randomUUID();
  const secret = "s".repeat(32);
  process.env.URBANPIPER_STORES = JSON.stringify([{ restaurantId, businessId: "10", storeId: "20", webhookSecret: secret }]);
  let saved: any;
  const delegate = prisma.urbanPiperOrder;
  const original = { upsert: delegate.upsert, findFirst: delegate.findFirst, updateMany: delegate.updateMany, update: delegate.update };
  Object.assign(prisma.urbanPiperOrder, { upsert: async (args: any) => {
    saved ??= { id: randomUUID(), ...args.create, statusUpdatedAt: null, cancellationPayload: null };
    return saved;
  }, findFirst: async (args: any) => {
    if (!saved || Object.entries(args.where).some(([key, value]) => saved[key] !== value)) return null;
    return saved;
  }, updateMany: async (args: any) => {
    const timestamp = args.where.OR[1].statusUpdatedAt.lt;
    if (!saved.statusUpdatedAt || saved.statusUpdatedAt < timestamp) Object.assign(saved, args.data);
    return { count: 1 };
  }, update: async (args: any) => {
    Object.assign(saved, args.data);
    return saved;
  } });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/api/v1`;
  const post = (path: string, body: unknown, webhookSecret = secret) => fetch(`${base}/webhooks/urbanpiper/${path}`, {
    method: "POST", headers: { "content-type": "application/json", "x-upr-biz-id": "10", "x-urbanpiper-secret": webhookSecret }, body: JSON.stringify(body),
  });
  const relay = { order: { details: { id: 30, biz_id: 10, channel: "zomato", order_state: "Placed" }, store: { id: 20 }, items: [] } };
  try {
    assert.equal((await post("orders", relay, "wrong")).status, 401);
    const first = await post("orders", relay);
    assert.equal(first.status, 200);
    const reference = (await first.json()).order_ref_id;
    assert.equal((await (await post("orders", relay)).json()).order_ref_id, reference);
    const event = { order_id: 30, store_upipr_id: 20, new_state: "Food Ready", timestamp_unix: 2000 };
    assert.equal((await post("order-status", event)).status, 200);
    assert.equal((await post("order-status", { ...event, new_state: "Acknowledged", timestamp_unix: 1000 })).status, 200);
    assert.equal(saved.status, "Food Ready");
    assert.equal((await post("order-status", { ...event, new_state: "customer_cancelled", timestamp_unix: 3000 })).status, 200);
    assert.equal(saved.status, "Food Ready");
    assert.equal(saved.cancellationPayload.new_state, "customer_cancelled");
    assert.equal((await post("order-status", { ...event, order_id: 31 })).status, 503);
    const token = (tenantId: string) => jwt.sign({ restaurantId: tenantId, role: "STAFF", type: "access" }, process.env.JWT_ACCESS_SECRET ?? "development-access-secret", { subject: randomUUID() });
    const getOrder = (tenantId: string) => fetch(`${base}/urbanpiper/orders/${reference}`, { headers: { Authorization: `Bearer ${token(tenantId)}` } });
    assert.equal((await getOrder(restaurantId)).status, 200);
    assert.equal((await getOrder(randomUUID())).status, 404);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    Object.assign(delegate, original);
    if (previous === undefined) delete process.env.URBANPIPER_STORES; else process.env.URBANPIPER_STORES = previous;
  }
});