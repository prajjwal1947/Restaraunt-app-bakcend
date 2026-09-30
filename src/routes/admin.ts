import { Router, type Request } from "express";
import multer from "multer";
import QRCode from "qrcode";
import crypto from "node:crypto";
import { OrderStatus, UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  asyncRoute,
  collection,
  HttpError,
  integerValue,
  parsePage,
  requireBody,
  stringValue,
} from "../lib/http";
import { authenticate, requireRole } from "../lib/auth";
import { uploadToSupabase } from "../lib/storage";

export const adminRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});
adminRouter.use(authenticate);

const tenant = (request: Request) => request.auth!.restaurantId;
const id = (request: Request, name: string) =>
  stringValue(request.params[name], name)!;
const pageArgs = (request: Request) => ({
  page: parsePage(request.query.page, 1, 1000),
  pageSize: parsePage(request.query.pageSize, 20, 100),
});
const categoryView = (category: any) => ({ ...category, items: undefined });
const itemView = (item: any) => ({
  ...item,
  addOns: item.addOns?.map((link: any) => link.addOn ?? link),
});
const orderView = (order: any) => ({
  ...order,
  tableNumber: order.table?.number,
  items: order.items?.map((item: any) => ({ ...item, addOns: item.addOns })),
});

adminRouter.get(
  "/restaurant",
  asyncRoute(async (request, response) => {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: tenant(request) },
    });
    if (!restaurant)
      throw new HttpError(404, "NOT_FOUND", "Restaurant not found.");
    response.json({ data: restaurant });
  }),
);

adminRouter.patch(
  "/restaurant",
  requireRole("OWNER", "MANAGER"),
  asyncRoute(async (request, response) => {
    const body = requireBody(request.body);
    const restaurant = await prisma.restaurant.update({
      where: { id: tenant(request) },
      data: {
        ...(body.name !== undefined
          ? { name: stringValue(body.name, "name") }
          : {}),
        ...(body.tagline !== undefined
          ? { tagline: stringValue(body.tagline, "tagline", false) }
          : {}),
        ...(body.email !== undefined
          ? { email: stringValue(body.email, "email")!.toLowerCase() }
          : {}),
        ...(body.phone !== undefined
          ? { phone: stringValue(body.phone, "phone", false) }
          : {}),
        ...(body.address !== undefined
          ? { address: stringValue(body.address, "address", false) }
          : {}),
        ...(body.city !== undefined
          ? { city: stringValue(body.city, "city", false) }
          : {}),
        ...(body.currency !== undefined
          ? { currency: stringValue(body.currency, "currency") }
          : {}),
        ...(body.timezone !== undefined
          ? { timezone: stringValue(body.timezone, "timezone") }
          : {}),
      },
    });
    response.json({ data: restaurant });
  }),
);

const imageUpload = (field: "logoUrl" | "imageUrl", folder: string) =>
  asyncRoute(async (request, response) => {
    const file = request.file;
    if (!file)
      throw new HttpError(
        422,
        "VALIDATION_ERROR",
        "An image file is required.",
      );
    const url = await uploadToSupabase(
      file,
      `${tenant(request)}/${folder}/${crypto.randomUUID()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "-")}`,
    );
    const data = field === "logoUrl" ? { logoUrl: url } : undefined;
    if (data) {
      const restaurant = await prisma.restaurant.update({
        where: { id: tenant(request) },
        data,
      });
      response.json({ data: restaurant });
      return;
    }
    response.json({ data: { url } });
  });
adminRouter.post(
  "/restaurant/logo/upload",
  requireRole("OWNER", "MANAGER"),
  upload.single("file"),
  imageUpload("logoUrl", "logos"),
);

adminRouter.get(
  "/menu/categories",
  asyncRoute(async (request, response) => {
    const categories = await prisma.menuCategory.findMany({
      where: { restaurantId: tenant(request) },
      orderBy: { sortOrder: "asc" },
    });
    response.json({ data: categories.map(categoryView) });
  }),
);
adminRouter.post(
  "/menu/categories",
  requireRole("OWNER", "MANAGER"),
  asyncRoute(async (request, response) => {
    const body = requireBody(request.body);
    const category = await prisma.menuCategory.create({
      data: {
        restaurantId: tenant(request),
        name: stringValue(body.name, "name")!,
        sortOrder:
          body.sortOrder === undefined
            ? 0
            : integerValue(body.sortOrder, "sortOrder"),
      },
    });
    response.status(201).json({ data: category });
  }),
);
adminRouter.patch(
  "/menu/categories/:categoryId",
  requireRole("OWNER", "MANAGER"),
  asyncRoute(async (request, response) => {
    const body = requireBody(request.body);
    const category = await prisma.menuCategory.updateMany({
      where: { id: id(request, "categoryId"), restaurantId: tenant(request) },
      data: {
        ...(body.name !== undefined
          ? { name: stringValue(body.name, "name") }
          : {}),
        ...(body.sortOrder !== undefined
          ? { sortOrder: integerValue(body.sortOrder, "sortOrder") }
          : {}),
        ...(body.isActive !== undefined
          ? { isActive: Boolean(body.isActive) }
          : {}),
      },
    });
    if (!category.count)
      throw new HttpError(404, "NOT_FOUND", "Category not found.");
    response.json({
      data: await prisma.menuCategory.findUnique({
        where: { id: id(request, "categoryId") },
      }),
    });
  }),
);
adminRouter.delete(
  "/menu/categories/:categoryId",
  requireRole("OWNER", "MANAGER"),
  asyncRoute(async (request, response) => {
    const categoryId = id(request, "categoryId");
    const count = await prisma.menuItem.count({
      where: { categoryId, restaurantId: tenant(request) },
    });
    if (count)
      throw new HttpError(
        409,
        "CATEGORY_NOT_EMPTY",
        "Move or delete the category items first.",
      );
    const deleted = await prisma.menuCategory.deleteMany({
      where: { id: categoryId, restaurantId: tenant(request) },
    });
    if (!deleted.count)
      throw new HttpError(404, "NOT_FOUND", "Category not found.");
    response.status(204).send();
  }),
);
adminRouter.post(
  "/menu/categories/reorder",
  requireRole("OWNER", "MANAGER"),
  asyncRoute(async (request, response) => {
    const body = requireBody(request.body);
    if (!Array.isArray(body.categoryIds))
      throw new HttpError(
        422,
        "VALIDATION_ERROR",
        "categoryIds must be an array.",
      );
    await prisma.$transaction(
      body.categoryIds.map((categoryId, index) =>
        prisma.menuCategory.updateMany({
          where: { id: String(categoryId), restaurantId: tenant(request) },
          data: { sortOrder: index },
        }),
      ),
    );
    response.json({
      data: await prisma.menuCategory.findMany({
        where: { restaurantId: tenant(request) },
        orderBy: { sortOrder: "asc" },
      }),
    });
  }),
);

const menuInclude = {
  category: true,
  addOns: { include: { addOn: true } },
  variants: { orderBy: { sortOrder: "asc" } },
} as const;
const parseVariants = (value: unknown) => {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 20)
    throw new HttpError(422, "VALIDATION_ERROR", "variants must contain no more than 20 options.");
  const names = new Set<string>();
  return value.map((rawVariant, index) => {
    if (!rawVariant || typeof rawVariant !== "object" || Array.isArray(rawVariant))
      throw new HttpError(422, "VALIDATION_ERROR", "Each variant must be an object.");
    const variant = rawVariant as Record<string, unknown>;
    const name = stringValue(variant.name, `variants.${index}.name`)!;
    const normalizedName = name.toLocaleLowerCase();
    if (names.has(normalizedName))
      throw new HttpError(422, "VALIDATION_ERROR", "Variant names must be unique for a menu item.");
    names.add(normalizedName);
    return {
      name,
      priceMinor: integerValue(variant.priceMinor, `variants.${index}.priceMinor`),
      sortOrder: index,
    };
  });
};
adminRouter.get(
  "/menu/items",
  asyncRoute(async (request, response) => {
    const { page, pageSize } = pageArgs(request);
    const where = {
      restaurantId: tenant(request),
      ...(request.query.categoryId
        ? { categoryId: String(request.query.categoryId) }
        : {}),
      ...(request.query.search
        ? {
            name: {
              contains: String(request.query.search),
              mode: "insensitive" as const,
            },
          }
        : {}),
      ...(request.query.available !== undefined
        ? { isAvailable: request.query.available === "true" }
        : {}),
    };
    const [items, total] = await prisma.$transaction([
      prisma.menuItem.findMany({
        where,
        include: menuInclude,
        orderBy: { sortOrder: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.menuItem.count({ where }),
    ]);
    response.json(collection(items.map(itemView), page, pageSize, total));
  }),
);
adminRouter.get(
  "/menu/items/:itemId",
  asyncRoute(async (request, response) => {
    const item = await prisma.menuItem.findFirst({
      where: { id: id(request, "itemId"), restaurantId: tenant(request) },
      include: menuInclude,
    });
    if (!item) throw new HttpError(404, "NOT_FOUND", "Menu item not found.");
    response.json({ data: itemView(item) });
  }),
);
adminRouter.post(
  "/menu/items",
  requireRole("OWNER", "MANAGER"),
  asyncRoute(async (request, response) => {
    const body = requireBody(request.body);
    const categoryId = stringValue(body.categoryId, "categoryId")!;
    const category = await prisma.menuCategory.findFirst({
      where: { id: categoryId, restaurantId: tenant(request) },
    });
    if (!category)
      throw new HttpError(
        422,
        "VALIDATION_ERROR",
        "Category does not belong to this restaurant.",
      );
    const addOnIds = Array.isArray(body.addOnIds)
      ? body.addOnIds.map(String)
      : [];
    const addOns = await prisma.addOn.findMany({
      where: { id: { in: addOnIds }, restaurantId: tenant(request) },
    });
    if (addOns.length !== addOnIds.length)
      throw new HttpError(
        422,
        "VALIDATION_ERROR",
        "One or more add-ons are invalid.",
      );
    const variants = parseVariants(body.variants);
    const item = await prisma.menuItem.create({
      data: {
        restaurantId: tenant(request),
        categoryId,
        name: stringValue(body.name, "name")!,
        description: stringValue(body.description, "description", false),
        priceMinor: integerValue(body.priceMinor, "priceMinor"),
        imageUrl: stringValue(body.imageUrl, "imageUrl", false),
        isAvailable:
          body.isAvailable === undefined ? true : Boolean(body.isAvailable),
        sortOrder:
          body.sortOrder === undefined
            ? 0
            : integerValue(body.sortOrder, "sortOrder"),
        addOns: { create: addOnIds.map((addOnId) => ({ addOnId })) },
        ...(variants.length ? { variants: { create: variants } } : {}),
      },
      include: menuInclude,
    });
    response.status(201).json({ data: itemView(item) });
    }),
  );
  adminRouter.post(
    "/menu/items/bulk",
    requireRole("OWNER", "MANAGER"),
    asyncRoute(async (request, response) => {
      const body = requireBody(request.body);
      if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 100)
        throw new HttpError(422, "VALIDATION_ERROR", "items must contain between 1 and 100 menu items.");

      const entries = body.items.map((value, index) => {
        if (!value || typeof value !== "object" || Array.isArray(value))
          throw new HttpError(422, "VALIDATION_ERROR", `Item ${index + 1} must be an object.`);
        const item = value as Record<string, unknown>;
        const addOnIds = Array.isArray(item.addOnIds) ? item.addOnIds.map(String) : [];
        return {
          categoryId: stringValue(item.categoryId, `items.${index}.categoryId`)!,
          name: stringValue(item.name, `items.${index}.name`)!,
          description: stringValue(item.description, `items.${index}.description`, false),
          priceMinor: integerValue(item.priceMinor, `items.${index}.priceMinor`),
          imageUrl: stringValue(item.imageUrl, `items.${index}.imageUrl`, false),
          isAvailable: item.isAvailable === undefined ? true : Boolean(item.isAvailable),
          sortOrder: item.sortOrder === undefined ? index : integerValue(item.sortOrder, `items.${index}.sortOrder`),
          addOnIds,
          variants: parseVariants(item.variants),
        };
      });

      const categoryIds = [...new Set(entries.map((item) => item.categoryId))];
      const categories = await prisma.menuCategory.findMany({
        where: { id: { in: categoryIds }, restaurantId: tenant(request) },
        select: { id: true },
      });
      if (categories.length !== categoryIds.length)
        throw new HttpError(422, "VALIDATION_ERROR", "One or more categories do not belong to this restaurant.");

      const addOnIds = [...new Set(entries.flatMap((item) => item.addOnIds))];
      const addOns = addOnIds.length
        ? await prisma.addOn.findMany({
            where: { id: { in: addOnIds }, restaurantId: tenant(request) },
            select: { id: true },
          })
        : [];
      if (addOns.length !== addOnIds.length)
        throw new HttpError(422, "VALIDATION_ERROR", "One or more add-ons are invalid.");

      const created = await prisma.$transaction(entries.map((item) =>
        prisma.menuItem.create({
          data: {
            restaurantId: tenant(request),
            categoryId: item.categoryId,
            name: item.name,
            description: item.description,
            priceMinor: item.priceMinor,
            imageUrl: item.imageUrl,
            isAvailable: item.isAvailable,
            sortOrder: item.sortOrder,
            addOns: { create: item.addOnIds.map((addOnId) => ({ addOnId })) },
            ...(item.variants.length ? { variants: { create: item.variants } } : {}),
          },
          include: menuInclude,
        }),
      ));
      response.status(201).json({ data: created.map(itemView) });
    }),
  );
  adminRouter.patch(
  "/menu/items/:itemId",
  requireRole("OWNER", "MANAGER"),
  asyncRoute(async (request, response) => {
    const itemId = id(request, "itemId");
    const body = requireBody(request.body);
    const existing = await prisma.menuItem.findFirst({
      where: { id: itemId, restaurantId: tenant(request) },
    });
    if (!existing)
      throw new HttpError(404, "NOT_FOUND", "Menu item not found.");
    const variants = body.variants === undefined
      ? undefined
      : parseVariants(body.variants);
    const item = await prisma.menuItem.update({
      where: { id: itemId },
      data: {
        ...(body.name !== undefined
          ? { name: stringValue(body.name, "name") }
          : {}),
        ...(body.description !== undefined
          ? { description: stringValue(body.description, "description", false) }
          : {}),
        ...(body.priceMinor !== undefined
          ? { priceMinor: integerValue(body.priceMinor, "priceMinor") }
          : {}),
        ...(body.categoryId !== undefined
          ? { categoryId: stringValue(body.categoryId, "categoryId") }
          : {}),
        ...(body.imageUrl !== undefined
          ? { imageUrl: stringValue(body.imageUrl, "imageUrl", false) }
          : {}),
        ...(body.isAvailable !== undefined
          ? { isAvailable: Boolean(body.isAvailable) }
          : {}),
        ...(body.sortOrder !== undefined
          ? { sortOrder: integerValue(body.sortOrder, "sortOrder") }
          : {}),
        ...(variants !== undefined
          ? { variants: { deleteMany: {}, create: variants } }
          : {}),
      },
      include: menuInclude,
    });
    response.json({ data: itemView(item) });
  }),
);
adminRouter.delete(
  "/menu/items/:itemId",
  requireRole("OWNER", "MANAGER"),
  asyncRoute(async (request, response) => {
    const deleted = await prisma.menuItem.deleteMany({
      where: { id: id(request, "itemId"), restaurantId: tenant(request) },
    });
    if (!deleted.count)
      throw new HttpError(404, "NOT_FOUND", "Menu item not found.");
    response.status(204).send();
  }),
);
adminRouter.patch(
  "/menu/items/:itemId/availability",
  asyncRoute(async (request, response) => {
    const body = requireBody(request.body);
    const updated = await prisma.menuItem.updateMany({
      where: { id: id(request, "itemId"), restaurantId: tenant(request) },
      data: { isAvailable: Boolean(body.isAvailable) },
    });
    if (!updated.count)
      throw new HttpError(404, "NOT_FOUND", "Menu item not found.");
    response.json({
      data: await prisma.menuItem.findUnique({
        where: { id: id(request, "itemId") },
      }),
    });
  }),
);
adminRouter.post(
  "/menu/items/:itemId/image/upload",
  requireRole("OWNER", "MANAGER"),
  upload.single("file"),
  asyncRoute(async (request, response) => {
    const itemId = id(request, "itemId");
    const item = await prisma.menuItem.findFirst({
      where: { id: itemId, restaurantId: tenant(request) },
    });
    if (!item) throw new HttpError(404, "NOT_FOUND", "Menu item not found.");
    if (!request.file)
      throw new HttpError(422, "VALIDATION_ERROR", "An image file is required.");

    const imageUrl = await uploadToSupabase(
      request.file,
      `${tenant(request)}/menu/${crypto.randomUUID()}-${request.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "-")}`,
    );
    const updated = await prisma.menuItem.update({
      where: { id: itemId },
      data: { imageUrl },
    });
    response.json({ data: { ...updated, url: imageUrl } });
  }),
);

adminRouter.get(
  "/menu/add-ons",
  asyncRoute(async (request, response) =>
    response.json({
      data: await prisma.addOn.findMany({
        where: { restaurantId: tenant(request) },
        orderBy: { name: "asc" },
      }),
    }),
  ),
);
adminRouter.post(
  "/menu/add-ons",
  requireRole("OWNER", "MANAGER"),
  asyncRoute(async (request, response) => {
    const body = requireBody(request.body);
    const addOn = await prisma.addOn.create({
      data: {
        restaurantId: tenant(request),
        name: stringValue(body.name, "name")!,
        priceMinor: integerValue(body.priceMinor, "priceMinor"),
        isAvailable:
          body.isAvailable === undefined ? true : Boolean(body.isAvailable),
      },
    });
    response.status(201).json({ data: addOn });
  }),
);
adminRouter.patch(
  "/menu/add-ons/:addOnId",
  requireRole("OWNER", "MANAGER"),
  asyncRoute(async (request, response) => {
    const body = requireBody(request.body);
    const updated = await prisma.addOn.updateMany({
      where: { id: id(request, "addOnId"), restaurantId: tenant(request) },
      data: {
        ...(body.name !== undefined
          ? { name: stringValue(body.name, "name") }
          : {}),
        ...(body.priceMinor !== undefined
          ? { priceMinor: integerValue(body.priceMinor, "priceMinor") }
          : {}),
        ...(body.isAvailable !== undefined
          ? { isAvailable: Boolean(body.isAvailable) }
          : {}),
      },
    });
    if (!updated.count)
      throw new HttpError(404, "NOT_FOUND", "Add-on not found.");
    response.json({
      data: await prisma.addOn.findUnique({
        where: { id: id(request, "addOnId") },
      }),
    });
  }),
);
adminRouter.delete(
  "/menu/add-ons/:addOnId",
  requireRole("OWNER", "MANAGER"),
  asyncRoute(async (request, response) => {
    const deleted = await prisma.addOn.deleteMany({
      where: { id: id(request, "addOnId"), restaurantId: tenant(request) },
    });
    if (!deleted.count)
      throw new HttpError(404, "NOT_FOUND", "Add-on not found.");
    response.status(204).send();
  }),
);

adminRouter.get(
  "/tables",
  asyncRoute(async (request, response) => {
    const tables = await prisma.restaurantTable.findMany({
      where: {
        restaurantId: tenant(request),
        ...(request.query.status
          ? { status: String(request.query.status) as any }
          : {}),
        ...(request.query.search
          ? { number: Number(request.query.search) }
          : {}),
      },
      include: {
        orders: {
          where: { status: { notIn: ["SERVED", "CANCELLED"] } },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { number: "asc" },
    });
    response.json({
      data: tables.map((table) => ({
        ...table,
        currentOrderNumber: table.orders[0]?.orderNumber,
        currentOrderTotal: table.orders[0]?.totalMinor,
        orders: undefined,
      })),
    });
  }),
);
adminRouter.get(
  "/tables/:tableId",
  asyncRoute(async (request, response) => {
    const table = await prisma.restaurantTable.findFirst({
      where: { id: id(request, "tableId"), restaurantId: tenant(request) },
    });
    if (!table) throw new HttpError(404, "NOT_FOUND", "Table not found.");
    response.json({
      data: {
        ...table,
        qrUrl: `${process.env.CLIENT_CUSTOMER_URL ?? "http://localhost:5174"}/t/${table.qrToken}`,
      },
    });
  }),
);
adminRouter.post(
  "/tables",
  requireRole("OWNER", "MANAGER"),
  asyncRoute(async (request, response) => {
    const body = requireBody(request.body);
    const table = await prisma.restaurantTable.create({
      data: {
        restaurantId: tenant(request),
        number: integerValue(body.number, "number", 1),
        capacity: integerValue(body.capacity, "capacity", 1),
        qrToken: crypto.randomBytes(24).toString("base64url"),
      },
    });
    response
      .status(201)
      .json({
        data: {
          ...table,
          qrUrl: `${process.env.CLIENT_CUSTOMER_URL ?? "http://localhost:5174"}/t/${table.qrToken}`,
        },
      });
  }),
);
adminRouter.patch(
  "/tables/:tableId",
  requireRole("OWNER", "MANAGER"),
  asyncRoute(async (request, response) => {
    const body = requireBody(request.body);
    const updated = await prisma.restaurantTable.updateMany({
      where: { id: id(request, "tableId"), restaurantId: tenant(request) },
      data: {
        ...(body.number !== undefined
          ? { number: integerValue(body.number, "number", 1) }
          : {}),
        ...(body.capacity !== undefined
          ? { capacity: integerValue(body.capacity, "capacity", 1) }
          : {}),
        ...(body.status !== undefined
          ? { status: String(body.status) as any }
          : {}),
        ...(body.isActive !== undefined
          ? { isActive: Boolean(body.isActive) }
          : {}),
      },
    });
    if (!updated.count)
      throw new HttpError(404, "NOT_FOUND", "Table not found.");
    response.json({
      data: await prisma.restaurantTable.findUnique({
        where: { id: id(request, "tableId") },
      }),
    });
  }),
);
adminRouter.delete(
  "/tables/:tableId",
  requireRole("OWNER", "MANAGER"),
  asyncRoute(async (request, response) => {
    const deleted = await prisma.restaurantTable.deleteMany({
      where: { id: id(request, "tableId"), restaurantId: tenant(request) },
    });
    if (!deleted.count)
      throw new HttpError(404, "NOT_FOUND", "Table not found.");
    response.status(204).send();
  }),
);
adminRouter.post(
  "/tables/:tableId/regenerate-qr",
  requireRole("OWNER", "MANAGER"),
  asyncRoute(async (request, response) => {
    const updated = await prisma.restaurantTable.updateMany({
      where: { id: id(request, "tableId"), restaurantId: tenant(request) },
      data: { qrToken: crypto.randomBytes(24).toString("base64url") },
    });
    if (!updated.count)
      throw new HttpError(404, "NOT_FOUND", "Table not found.");
    const table = await prisma.restaurantTable.findUnique({
      where: { id: id(request, "tableId") },
    });
    response.json({
      data: {
        ...table,
        qrUrl: `${process.env.CLIENT_CUSTOMER_URL ?? "http://localhost:5174"}/t/${table!.qrToken}`,
      },
    });
  }),
);
adminRouter.get(
  "/tables/:tableId/qr",
  asyncRoute(async (request, response) => {
    const table = await prisma.restaurantTable.findFirst({
      where: { id: id(request, "tableId"), restaurantId: tenant(request) },
    });
    if (!table) throw new HttpError(404, "NOT_FOUND", "Table not found.");
    const url = `${process.env.CLIENT_CUSTOMER_URL ?? "http://localhost:5174"}/t/${table.qrToken}`;
    response.type("text/plain").send(await QRCode.toDataURL(url));
  }),
);

const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY"],
  READY: ["SERVED"],
  SERVED: [],
  CANCELLED: [],
};
adminRouter.get(
  "/orders",
  asyncRoute(async (request, response) => {
    const { page, pageSize } = pageArgs(request);
    const where = {
      restaurantId: tenant(request),
      ...(request.query.status
        ? { status: String(request.query.status) as OrderStatus }
        : {}),
      ...(request.query.search
        ? { orderNumber: Number(request.query.search) }
        : {}),
    };
    const [orders, total] = await prisma.$transaction([
      prisma.order.findMany({
        where,
        include: { table: true, items: { include: { addOns: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.order.count({ where }),
    ]);
    response.json(collection(orders.map(orderView), page, pageSize, total));
  }),
);
adminRouter.get(
  "/orders/:orderId",
  asyncRoute(async (request, response) => {
    const order = await prisma.order.findFirst({
      where: { id: id(request, "orderId"), restaurantId: tenant(request) },
      include: {
        table: true,
        items: { include: { addOns: true } },
        statusEvents: true,
      },
    });
    if (!order) throw new HttpError(404, "NOT_FOUND", "Order not found.");
    response.json({ data: orderView(order) });
  }),
);
adminRouter.patch(
  "/orders/:orderId/status",
  requireRole("OWNER", "MANAGER", "STAFF"),
  asyncRoute(async (request, response) => {
    const body = requireBody(request.body);
    const next = String(body.status) as OrderStatus;
    const order = await prisma.order.findFirst({
      where: { id: id(request, "orderId"), restaurantId: tenant(request) },
    });
    if (!order) throw new HttpError(404, "NOT_FOUND", "Order not found.");
    if (!allowedTransitions[order.status].includes(next))
      throw new HttpError(
        409,
        "INVALID_STATUS_TRANSITION",
        `Cannot change an order from ${order.status} to ${next}.`,
      );
    const now = new Date();
    const updated = await prisma.$transaction(async (transaction) => {
      const saved = await transaction.order.update({
        where: { id: order.id },
        data: {
          status: next,
          ...(next === "CONFIRMED" ? { confirmedAt: now } : {}),
          ...(next === "SERVED" ? { servedAt: now } : {}),
          ...(next === "CANCELLED" ? { cancelledAt: now } : {}),
        },
        include: { table: true, items: { include: { addOns: true } } },
      });
      await transaction.orderStatusEvent.create({
        data: {
          orderId: order.id,
          actorId: request.auth!.userId,
          previous: order.status,
          next,
        },
      });
      if (next === "SERVED" || next === "CANCELLED")
        await transaction.restaurantTable.update({
          where: { id: order.tableId },
          data: { status: "AVAILABLE" },
        });
      else
        await transaction.restaurantTable.update({
          where: { id: order.tableId },
          data: { status: "OCCUPIED" },
        });
      return saved;
    });
    response.json({ data: orderView(updated) });
  }),
);
adminRouter.post(
  "/orders/:orderId/cancel",
  requireRole("OWNER", "MANAGER", "STAFF"),
  asyncRoute(async (request, response) => {
    request.body = { status: "CANCELLED" };
    const order = await prisma.order.findFirst({
      where: { id: id(request, "orderId"), restaurantId: tenant(request) },
    });
    if (!order) throw new HttpError(404, "NOT_FOUND", "Order not found.");
    if (!allowedTransitions[order.status].includes("CANCELLED"))
      throw new HttpError(
        409,
        "INVALID_STATUS_TRANSITION",
        "This order cannot be cancelled.",
      );
    const updated = await prisma.$transaction(async (transaction) => {
      const saved = await transaction.order.update({
        where: { id: order.id },
        data: { status: "CANCELLED", cancelledAt: new Date() },
        include: { table: true, items: { include: { addOns: true } } },
      });
      await transaction.orderStatusEvent.create({
        data: {
          orderId: order.id,
          actorId: request.auth!.userId,
          previous: order.status,
          next: "CANCELLED",
        },
      });
      await transaction.restaurantTable.update({
        where: { id: order.tableId },
        data: { status: "AVAILABLE" },
      });
      return saved;
    });
    response.json({ data: orderView(updated) });
  }),
);

adminRouter.get(
  "/dashboard/summary",
  asyncRoute(async (request, response) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const [orders, sales, tables] = await Promise.all([
      prisma.order.groupBy({
        by: ["status"],
        where: { restaurantId: tenant(request), createdAt: { gte: start } },
        _count: true,
      }),
      prisma.order.aggregate({
        where: {
          restaurantId: tenant(request),
          createdAt: { gte: start },
          status: { not: "CANCELLED" },
        },
        _sum: { totalMinor: true },
        _count: true,
      }),
      prisma.restaurantTable.count({
        where: { restaurantId: tenant(request), isActive: true },
      }),
    ]);
    response.json({
      data: {
        pendingOrders:
          orders.find((item) => item.status === "PENDING")?._count ?? 0,
        preparingOrders:
          orders.find((item) => item.status === "PREPARING")?._count ?? 0,
        readyOrders:
          orders.find((item) => item.status === "READY")?._count ?? 0,
        todaySalesMinor: sales._sum.totalMinor ?? 0,
        todayOrderCount: sales._count,
        activeTableCount: tables,
      },
    });
  }),
);
adminRouter.get(
  "/dashboard/live-orders",
  asyncRoute(async (request, response) => {
    const orders = await prisma.order.findMany({
      where: {
        restaurantId: tenant(request),
        status: { in: ["PENDING", "CONFIRMED", "PREPARING", "READY"] },
      },
      include: { table: true, items: true },
      orderBy: { createdAt: "asc" },
    });
    response.json({ data: orders.map(orderView) });
  }),
);
adminRouter.get(
  "/dashboard/sales",
  asyncRoute(async (request, response) => {
    const from = request.query.from
      ? new Date(String(request.query.from))
      : new Date(Date.now() - 30 * 86400000);
    const to = request.query.to
      ? new Date(String(request.query.to))
      : new Date();
    const orders = await prisma.order.findMany({
      where: {
        restaurantId: tenant(request),
        createdAt: { gte: from, lte: to },
        status: { not: "CANCELLED" },
      },
      select: { totalMinor: true, createdAt: true },
    });
    const grouped = new Map<
      string,
      { totalMinor: number; orderCount: number }
    >();
    for (const order of orders) {
      const key = order.createdAt.toISOString().slice(0, 10);
      const entry = grouped.get(key) ?? { totalMinor: 0, orderCount: 0 };
      entry.totalMinor += order.totalMinor;
      entry.orderCount += 1;
      grouped.set(key, entry);
    }
    response.json({
      data: [...grouped.entries()]
        .map(([date, values]) => ({ date, ...values }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    });
  }),
);

adminRouter.get(
  "/dashboard/product-analytics",
  asyncRoute(async (request, response) => {
    const now = new Date();
    const weeklyStart = new Date(now);
    weeklyStart.setDate(weeklyStart.getDate() - 6);
    weeklyStart.setHours(0, 0, 0, 0);
    const historyStart = new Date(now);
    historyStart.setMonth(historyStart.getMonth() - 5, 1);
    historyStart.setHours(0, 0, 0, 0);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const lines = await prisma.orderItem.findMany({
      where: {
        order: {
          restaurantId: tenant(request),
          status: { not: "CANCELLED" },
          createdAt: { gte: historyStart },
        },
      },
      select: {
        menuItemId: true,
        nameSnapshot: true,
        quantity: true,
        lineTotalMinor: true,
        order: { select: { createdAt: true } },
        menuItem: { select: { name: true, isAvailable: true } },
      },
    });

    const productName = (line: (typeof lines)[number]) =>
      line.menuItem?.name || line.nameSnapshot;
    const weeklyProducts = new Map<string, { name: string; quantity: number; revenueMinor: number }>();
    const monthlyProducts = new Map<string, Map<string, { name: string; quantity: number; revenueMinor: number }>>();
    const dailyQuantities = new Map<string, Map<string, number>>();
    const activeProducts = new Map<string, string>();

    for (const line of lines) {
      const itemKey = line.menuItemId || `snapshot:${line.nameSnapshot}`;
      const name = productName(line);
      const date = line.order.createdAt;
      const dayKey = date.toISOString().slice(0, 10);
      const monthKey = dayKey.slice(0, 7);
      if (line.menuItemId && line.menuItem?.isAvailable) activeProducts.set(line.menuItemId, name);

      const daily = dailyQuantities.get(itemKey) ?? new Map<string, number>();
      daily.set(dayKey, (daily.get(dayKey) || 0) + line.quantity);
      dailyQuantities.set(itemKey, daily);

      const month = monthlyProducts.get(monthKey) ?? new Map<string, { name: string; quantity: number; revenueMinor: number }>();
      const monthlyProduct = month.get(itemKey) ?? { name, quantity: 0, revenueMinor: 0 };
      monthlyProduct.quantity += line.quantity;
      monthlyProduct.revenueMinor += line.lineTotalMinor;
      month.set(itemKey, monthlyProduct);
      monthlyProducts.set(monthKey, month);

      if (date >= weeklyStart) {
        const weeklyProduct = weeklyProducts.get(itemKey) ?? { name, quantity: 0, revenueMinor: 0 };
        weeklyProduct.quantity += line.quantity;
        weeklyProduct.revenueMinor += line.lineTotalMinor;
        weeklyProducts.set(itemKey, weeklyProduct);
      }
    }

    const monthKeys = Array.from({ length: 6 }, (_, index) => {
      const month = new Date(historyStart);
      month.setMonth(historyStart.getMonth() + index);
      return month.toISOString().slice(0, 7);
    });
    const forecastWeekday = tomorrow.getDay();
    const matchingWeekdays: string[] = [];
    for (let offset = 1; offset <= 35 && matchingWeekdays.length < 4; offset += 1) {
      const day = new Date(tomorrow);
      day.setDate(day.getDate() - offset);
      if (day.getDay() === forecastWeekday) matchingWeekdays.push(day.toISOString().slice(0, 10));
    }

    const prepForecast = [...activeProducts.entries()].map(([itemId, name]) => {
      const daily = dailyQuantities.get(itemId) || new Map<string, number>();
      const total = matchingWeekdays.reduce((sum, day) => sum + (daily.get(day) || 0), 0);
      const average = total / matchingWeekdays.length;
      return {
        itemId,
        name,
        forecastQuantity: Math.max(0, Math.round(average)),
        averageQuantity: Math.round(average * 10) / 10,
        sampleDays: matchingWeekdays.length,
      };
    }).sort((a, b) => b.forecastQuantity - a.forecastQuantity || a.name.localeCompare(b.name));

    response.json({
      data: {
        generatedAt: now.toISOString(),
        periods: {
          weeklyStart: weeklyStart.toISOString(),
          weeklyEnd: now.toISOString(),
          months: monthKeys,
          forecastDate: tomorrow.toISOString().slice(0, 10),
        },
        weeklyBestSellers: [...weeklyProducts.values()]
          .sort((a, b) => b.quantity - a.quantity)
          .slice(0, 10),
        monthlySales: monthKeys.map((month) => ({
          month,
          products: [...(monthlyProducts.get(month)?.values() || [])]
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10),
        })),
        prepForecast,
      },
    });
  }),
);
