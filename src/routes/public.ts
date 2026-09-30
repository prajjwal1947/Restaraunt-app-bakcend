import { Router } from "express";
import rateLimit from "express-rate-limit";
import { prisma } from "../lib/prisma";
import {
  asyncRoute,
  HttpError,
  integerValue,
  requireBody,
  stringValue,
} from "../lib/http";

export const publicRouter = Router();
const orderLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

const tableForToken = async (token: string) => {
  const table = await prisma.restaurantTable.findFirst({
    where: { qrToken: token, isActive: true },
    include: { restaurant: true },
  });
  if (!table) throw new HttpError(404, "NOT_FOUND", "Table context not found.");
  return table;
};

const menuRatingSummary = async (restaurantId: string) => {
  const summaries = await prisma.orderItem.groupBy({
    by: ["menuItemId"],
    where: {
      menuItemId: { not: null },
      rating: { not: null },
      order: { restaurantId, status: "SERVED" },
    },
    _avg: { rating: true },
    _count: { rating: true },
  });
  const ratingByItemId = new Map<string, { rating: number; ratingCount: number }>();
  for (const summary of summaries) {
    if (summary.menuItemId && summary._avg.rating !== null) {
      ratingByItemId.set(summary.menuItemId, {
        rating: Math.round(summary._avg.rating * 10) / 10,
        ratingCount: summary._count.rating,
      });
    }
  }
  return ratingByItemId;
};

const publicOrder = (order: any) => ({
  id: order.id,
  orderNumber: order.orderNumber,
  tableNumber: order.table?.number,
  status: order.status,
  subtotalMinor: order.subtotalMinor,
  taxMinor: order.taxMinor,
  discountMinor: order.discountMinor,
  totalMinor: order.totalMinor,
  rating: order.rating,
  customerNote: order.customerNote,
  currency: order.restaurant?.currency,
  placedAt: order.placedAt,
  createdAt: order.createdAt,
  updatedAt: order.updatedAt,
  items: order.items?.map((item: any) => ({ ...item, addOns: item.addOns })),
});

publicRouter.get(
  "/tables/:tableToken/context",
  asyncRoute(async (request, response) => {
    const table = await tableForToken(
      stringValue(request.params.tableToken, "tableToken")!,
    );
    response.json({
      data: {
        restaurant: {
          id: table.restaurant.id,
          name: table.restaurant.name,
          tagline: table.restaurant.tagline,
          currency: table.restaurant.currency,
        },
        table: { id: table.id, number: table.number, capacity: table.capacity },
      },
    });
  }),
);

publicRouter.get(
  "/tables/:tableToken/menu",
  asyncRoute(async (request, response) => {
    const table = await tableForToken(
      stringValue(request.params.tableToken, "tableToken")!,
    );
    const categories = await prisma.menuCategory.findMany({
      where: { restaurantId: table.restaurantId, isActive: true },
      orderBy: { sortOrder: "asc" },
      include: {
        items: {
          where: { isAvailable: true },
          orderBy: { sortOrder: "asc" },
          include: {
            variants: { orderBy: { sortOrder: "asc" } },
            addOns: {
              where: { addOn: { isAvailable: true } },
              include: { addOn: true },
            },
          },
        },
      },
    });
    const ratings = await menuRatingSummary(table.restaurantId);
    response.json({
      data: categories.map((category) => ({
        id: category.id,
        name: category.name,
        items: category.items.map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          priceMinor: item.priceMinor,
          currency: table.restaurant.currency,
          imageUrl: item.imageUrl,
          category: { id: category.id, name: category.name },
          variants: item.variants,
          addOns: item.addOns.map((link) => link.addOn),
          rating: ratings.get(item.id)?.rating ?? null,
          ratingCount: ratings.get(item.id)?.ratingCount ?? 0,
        })),
      })),
    });
  }),
);

publicRouter.get(
  "/tables/:tableToken/trending",
  asyncRoute(async (request, response) => {
    const table = await tableForToken(
      stringValue(request.params.tableToken, "tableToken")!,
    );
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const popularItems = await prisma.orderItem.groupBy({
      by: ["menuItemId"],
      where: {
        menuItemId: { not: null },
        order: {
          restaurantId: table.restaurantId,
          status: { not: "CANCELLED" },
          createdAt: { gte: since },
        },
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 20,
    });
    const itemIds = popularItems.flatMap((entry) => entry.menuItemId ? [entry.menuItemId] : []);
    const items = await prisma.menuItem.findMany({
      where: {
        restaurantId: table.restaurantId,
        id: { in: itemIds },
        isAvailable: true,
        category: { isActive: true },
      },
      include: {
        category: true,
        variants: { orderBy: { sortOrder: "asc" } },
        addOns: {
          where: { addOn: { isAvailable: true } },
          include: { addOn: true },
        },
      },
    });
    const itemsById = new Map(items.map((item) => [item.id, item]));
    const ratings = await menuRatingSummary(table.restaurantId);
    const data = popularItems.flatMap((entry) => {
      const item = entry.menuItemId ? itemsById.get(entry.menuItemId) : undefined;
      if (!item) return [];
      return [{
        id: item.id,
        name: item.name,
        description: item.description,
        priceMinor: item.priceMinor,
        currency: table.restaurant.currency,
        imageUrl: item.imageUrl,
        category: { id: item.category.id, name: item.category.name },
        variants: item.variants,
        addOns: item.addOns.map((link) => link.addOn),
        orderCount: entry._sum.quantity || 0,
        rating: ratings.get(item.id)?.rating ?? null,
        ratingCount: ratings.get(item.id)?.ratingCount ?? 0,
      }];
    }).slice(0, 5);
    response.json({ data });
  }),
);

publicRouter.get(
  "/tables/:tableToken/orders",
  asyncRoute(async (request, response) => {
    const table = await tableForToken(
      stringValue(request.params.tableToken, "tableToken")!,
    );
    const orders = await prisma.order.findMany({
      where: { restaurantId: table.restaurantId, tableId: table.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        restaurant: true,
        table: true,
        items: { include: { addOns: true } },
      },
    });
    response.json({ data: orders.map(publicOrder) });
  }),
);

publicRouter.post(
  "/tables/:tableToken/orders/:orderId/rating",
  asyncRoute(async (request, response) => {
    const table = await tableForToken(
      stringValue(request.params.tableToken, "tableToken")!,
    );
    const order = await prisma.order.findFirst({
      where: {
        id: stringValue(request.params.orderId, "orderId")!,
        restaurantId: table.restaurantId,
        tableId: table.id,
      },
    });
    if (!order) throw new HttpError(404, "NOT_FOUND", "Order not found for this table.");
    if (order.status !== "SERVED")
      throw new HttpError(409, "ORDER_NOT_COMPLETED", "Only served orders can be rated.");
    if (order.rating !== null)
      throw new HttpError(409, "ORDER_ALREADY_RATED", "This order has already been rated.");
    const body = requireBody(request.body);
    const rating = integerValue(body.rating, "rating", 1);
    if (rating > 5)
      throw new HttpError(422, "VALIDATION_ERROR", "Rating must be between 1 and 5.");
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { rating },
      include: {
        restaurant: true,
        table: true,
        items: { include: { addOns: true } },
      },
    });
    response.json({ data: publicOrder(updated) });
  }),
);

publicRouter.post(
  "/tables/:tableToken/orders/:orderId/items/:orderItemId/rating",
  asyncRoute(async (request, response) => {
    const table = await tableForToken(
      stringValue(request.params.tableToken, "tableToken")!,
    );
    const orderId = stringValue(request.params.orderId, "orderId")!;
    const orderItem = await prisma.orderItem.findFirst({
      where: {
        id: stringValue(request.params.orderItemId, "orderItemId")!,
        orderId,
        order: { restaurantId: table.restaurantId, tableId: table.id },
      },
      include: { order: true },
    });
    if (!orderItem)
      throw new HttpError(404, "NOT_FOUND", "Order item not found for this table.");
    if (orderItem.order.status !== "SERVED")
      throw new HttpError(409, "ORDER_NOT_COMPLETED", "Only items from served orders can be rated.");
    if (orderItem.rating !== null)
      throw new HttpError(409, "ORDER_ITEM_ALREADY_RATED", "This item has already been rated.");
    const body = requireBody(request.body);
    const rating = integerValue(body.rating, "rating", 1);
    if (rating > 5)
      throw new HttpError(422, "VALIDATION_ERROR", "Rating must be between 1 and 5.");
    const updated = await prisma.orderItem.update({
      where: { id: orderItem.id },
      data: { rating },
    });
    response.json({ data: { orderItemId: updated.id, rating: updated.rating } });
  }),
);

publicRouter.post(
  "/tables/:tableToken/orders",
  orderLimit,
  asyncRoute(async (request, response) => {
    const table = await tableForToken(
      stringValue(request.params.tableToken, "tableToken")!,
    );
    const idempotencyKey = request.header("idempotency-key");
    if (!idempotencyKey)
      throw new HttpError(
        422,
        "VALIDATION_ERROR",
        "Idempotency-Key header is required.",
      );
    const previous = await prisma.order.findFirst({
      where: { restaurantId: table.restaurantId, idempotencyKey },
      include: {
        restaurant: true,
        table: true,
        items: { include: { addOns: true } },
      },
    });
    if (previous) {
      response.status(200).json({ data: publicOrder(previous) });
      return;
    }

    const body = requireBody(request.body);
    if (!Array.isArray(body.items) || body.items.length === 0)
      throw new HttpError(
        422,
        "VALIDATION_ERROR",
        "An order must contain at least one item.",
      );
    if (body.items.length > 50)
      throw new HttpError(
        422,
        "VALIDATION_ERROR",
        "An order cannot contain more than 50 lines.",
      );
    const lines: Array<{
      menuItemId: string;
      name: string;
      unitPriceMinor: number;
      variantNameSnapshot: string | null;
      quantity: number;
      lineTotalMinor: number;
      addOns: Array<{
        addOnId: string;
        name: string;
        priceMinor: number;
        quantity: number;
      }>;
    }> = [];
    let subtotalMinor = 0;

    for (const rawLine of body.items) {
      if (!rawLine || typeof rawLine !== "object")
        throw new HttpError(
          422,
          "VALIDATION_ERROR",
          "Each order item must be an object.",
        );
      const line = rawLine as Record<string, unknown>;
      const menuItemId = stringValue(line.menuItemId, "menuItemId")!;
      const quantity = integerValue(line.quantity, "quantity", 1);
      if (quantity > 99)
        throw new HttpError(
          422,
          "VALIDATION_ERROR",
          "Quantity cannot exceed 99.",
        );
      const item = await prisma.menuItem.findFirst({
        where: {
          id: menuItemId,
          restaurantId: table.restaurantId,
          isAvailable: true,
        },
        include: { variants: { orderBy: { sortOrder: "asc" } } },
      });
      if (!item)
        throw new HttpError(
          422,
          "ITEM_UNAVAILABLE",
          "One or more menu items are unavailable.",
        );
      const variantId = line.variantId === undefined
        ? undefined
        : stringValue(line.variantId, "variantId");
      const variant = variantId
        ? item.variants.find((option) => option.id === variantId)
        : undefined;
      if (item.variants.length > 0 && !variantId)
        throw new HttpError(422, "VARIANT_REQUIRED", "Choose a size for each menu item.");
      if (variantId && !variant)
        throw new HttpError(422, "INVALID_VARIANT", "The selected size is not available for this item.");
      const addOnIds = Array.isArray(line.addOnIds)
        ? line.addOnIds.map(String)
        : [];
      const links = await prisma.menuItemAddOn.findMany({
        where: {
          menuItemId,
          addOnId: { in: addOnIds },
          addOn: { restaurantId: table.restaurantId, isAvailable: true },
        },
        include: { addOn: true },
      });
      if (links.length !== addOnIds.length)
        throw new HttpError(
          422,
          "INVALID_ADD_ON",
          "One or more add-ons are invalid for this item.",
        );
      const addOns = links.map((link) => ({
        addOnId: link.addOnId,
        name: link.addOn.name,
        priceMinor: link.addOn.priceMinor,
        quantity: 1,
      }));
      const unitWithAddOns =
        (variant?.priceMinor ?? item.priceMinor) +
        addOns.reduce((sum, addOn) => sum + addOn.priceMinor, 0);
      const lineTotalMinor = unitWithAddOns * quantity;
      subtotalMinor += lineTotalMinor;
      lines.push({
        menuItemId,
        name: item.name,
        unitPriceMinor: variant?.priceMinor ?? item.priceMinor,
        variantNameSnapshot: variant?.name ?? null,
        quantity,
        lineTotalMinor,
        addOns,
      });
    }

    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const last = await prisma.order.aggregate({
      where: { restaurantId: table.restaurantId, createdAt: { gte: start } },
      _max: { orderNumber: true },
    });
    const order = await prisma.$transaction(async (transaction) => {
      const created = await transaction.order.create({
        data: {
          restaurantId: table.restaurantId,
          tableId: table.id,
          orderNumber: (last._max.orderNumber ?? 0) + 1,
          status: "PENDING",
          subtotalMinor,
          taxMinor: 0,
          discountMinor: 0,
          totalMinor: subtotalMinor,
          customerNote: stringValue(body.customerNote, "customerNote", false),
          idempotencyKey,
          items: {
            create: lines.map((line) => ({
              menuItemId: line.menuItemId,
              nameSnapshot: line.name,
              variantNameSnapshot: line.variantNameSnapshot,
              unitPriceMinor: line.unitPriceMinor,
              quantity: line.quantity,
              lineTotalMinor: line.lineTotalMinor,
              addOns: {
                create: line.addOns.map((addOn) => ({
                  addOnId: addOn.addOnId,
                  nameSnapshot: addOn.name,
                  priceMinor: addOn.priceMinor,
                  quantity: addOn.quantity,
                })),
              },
            })),
          },
        },
        include: {
          restaurant: true,
          table: true,
          items: { include: { addOns: true } },
        },
      });
      await transaction.orderStatusEvent.create({
        data: { orderId: created.id, next: "PENDING" },
      });
      await transaction.restaurantTable.update({
        where: { id: table.id },
        data: { status: "OCCUPIED" },
      });
      return created;
    });
    response.status(201).json({ data: publicOrder(order) });
  }),
);

publicRouter.get(
  "/orders/:orderId",
  asyncRoute(async (request, response) => {
    const order = await prisma.order.findUnique({
      where: { id: stringValue(request.params.orderId, "orderId")! },
      include: {
        restaurant: true,
        table: true,
        items: { include: { addOns: true } },
      },
    });
    if (!order) throw new HttpError(404, "NOT_FOUND", "Order not found.");
    response.json({ data: publicOrder(order) });
  }),
);

publicRouter.get(
  "/orders/:orderId/events",
  asyncRoute(async (request, response) => {
    const orderId = stringValue(request.params.orderId, "orderId")!;
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new HttpError(404, "NOT_FOUND", "Order not found.");
    response.setHeader("Content-Type", "text/event-stream");
    response.setHeader("Cache-Control", "no-cache");
    response.setHeader("Connection", "keep-alive");
    response.flushHeaders();
    let lastStatus = order.status;
    const send = () => {
      response.write(
        `event: ORDER_STATUS_CHANGED\ndata: ${JSON.stringify({ type: "ORDER_STATUS_CHANGED", orderId, status: lastStatus, updatedAt: new Date().toISOString() })}\n\n`,
      );
    };
    send();
    const interval = setInterval(async () => {
      const current = await prisma.order.findUnique({
        where: { id: orderId },
        select: { status: true },
      });
      if (!current) return;
      if (current.status !== lastStatus) {
        lastStatus = current.status;
        send();
      }
    }, 10000);
    const close = () => clearInterval(interval);
    request.on("close", close);
  }),
);
