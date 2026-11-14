import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { authenticate, requireRole } from "../lib/auth";
import { asyncRoute, collection, HttpError, parsePage } from "../lib/http";
import { prisma } from "../lib/prisma";
import { matchUrbanPiperStore, parseUrbanPiperOrder, parseUrbanPiperStatus, sendUrbanPiperStatus, urbanPiperMappings } from "../lib/urbanPiper";

export const urbanPiperWebhookRouter = Router();
export const urbanPiperAdminRouter = Router();

urbanPiperWebhookRouter.post("/orders", asyncRoute(async (request, response) => {
  const parsed = parseUrbanPiperOrder(request.body);
  if (!parsed.success) throw new HttpError(400, "INVALID_WEBHOOK", "Invalid UrbanPiper order relay.");
  const { details, store } = parsed.data.order;
  if (request.header("x-upr-biz-id") !== details.biz_id) throw new HttpError(401, "URBANPIPER_UNAUTHORIZED", "Invalid UrbanPiper business.");
  const mapping = matchUrbanPiperStore(details.biz_id, store.id, request.header("x-urbanpiper-secret"));
  const order = await prisma.urbanPiperOrder.upsert({
    where: { businessId_externalOrderId: { businessId: details.biz_id, externalOrderId: details.id } },
    create: {
      restaurantId: mapping.restaurantId,
      businessId: details.biz_id,
      storeId: store.id,
      externalOrderId: details.id,
      channel: details.channel,
      status: details.order_state,
      payload: request.body as Prisma.InputJsonValue,
    },
    update: { externalOrderId: details.id },
  });
  if (order.restaurantId !== mapping.restaurantId || order.storeId !== store.id) {
    throw new HttpError(409, "URBANPIPER_ORDER_CONFLICT", "Order is already associated with another store.");
  }
  response.json({ order_ref_id: order.id });
}));

urbanPiperWebhookRouter.post("/order-status", asyncRoute(async (request, response) => {
  const parsed = parseUrbanPiperStatus(request.body);
  if (!parsed.success) throw new HttpError(400, "INVALID_WEBHOOK", "Invalid UrbanPiper status update.");
  const businessId = request.header("x-upr-biz-id") ?? "";
  const event = parsed.data;
  const mapping = matchUrbanPiperStore(businessId, event.store_upipr_id, request.header("x-urbanpiper-secret"));
  const where = { businessId, externalOrderId: event.order_id, storeId: event.store_upipr_id, restaurantId: mapping.restaurantId };
  const order = await prisma.urbanPiperOrder.findFirst({ where, select: { id: true } });
  if (!order) throw new HttpError(503, "URBANPIPER_ORDER_NOT_FOUND", "Order has not been received yet.");
  if (event.new_state === "customer_cancelled") {
    await prisma.urbanPiperOrder.update({ where: { id: order.id }, data: { cancellationPayload: request.body as Prisma.InputJsonValue } });
  } else {
    const timestamp = new Date(event.timestamp_unix);
    await prisma.urbanPiperOrder.updateMany({
      where: { id: order.id, OR: [{ statusUpdatedAt: null }, { statusUpdatedAt: { lt: timestamp } }] },
      data: { status: event.new_state, statusUpdatedAt: timestamp, statusPayload: request.body as Prisma.InputJsonValue },
    });
  }
  response.json({ status: "ok" });
}));

urbanPiperAdminRouter.use(authenticate);
urbanPiperAdminRouter.get("/urbanpiper/orders", asyncRoute(async (request, response) => {
  const page = parsePage(request.query.page, 1, 1000);
  const pageSize = parsePage(request.query.pageSize, 20, 100);
  const where = { restaurantId: request.auth!.restaurantId };
  const [orders, total] = await prisma.$transaction([
    prisma.urbanPiperOrder.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.urbanPiperOrder.count({ where }),
  ]);
  response.json(collection(orders, page, pageSize, total));
}));

urbanPiperAdminRouter.get("/urbanpiper/orders/:orderId", asyncRoute(async (request, response) => {
  const orderId = z.uuid().safeParse(request.params.orderId);
  if (!orderId.success) throw new HttpError(404, "NOT_FOUND", "Marketplace order not found.");
  const order = await prisma.urbanPiperOrder.findFirst({ where: { id: orderId.data, restaurantId: request.auth!.restaurantId } });
  if (!order) throw new HttpError(404, "NOT_FOUND", "Marketplace order not found.");
  response.json({ data: order });
}));

urbanPiperAdminRouter.post("/urbanpiper/orders/:orderId/status", requireRole("OWNER", "MANAGER", "STAFF"), asyncRoute(async (request, response) => {
  const orderId = z.uuid().safeParse(request.params.orderId);
  const body = z.object({ status: z.enum(["Acknowledged", "Food Ready", "Dispatched"]), prepTimeMinutes: z.number().int().min(0).optional() }).strict().safeParse(request.body);
  if (!orderId.success || !body.success || (body.data.prepTimeMinutes !== undefined && body.data.status !== "Acknowledged")) {
    throw new HttpError(400, "VALIDATION_ERROR", "Invalid marketplace order status request.");
  }
  const order = await prisma.urbanPiperOrder.findFirst({ where: { id: orderId.data, restaurantId: request.auth!.restaurantId } });
  if (!order) throw new HttpError(404, "NOT_FOUND", "Marketplace order not found.");
  const mapping = urbanPiperMappings().find((item) => item.restaurantId === order.restaurantId && item.businessId === order.businessId && item.storeId === order.storeId);
  if (!mapping) throw new HttpError(503, "URBANPIPER_NOT_CONFIGURED", "UrbanPiper store is no longer configured.");
  await sendUrbanPiperStatus(mapping, order.externalOrderId, body.data.status, body.data.prepTimeMinutes);
  response.json({ data: { accepted: true, status: body.data.status } });
}));