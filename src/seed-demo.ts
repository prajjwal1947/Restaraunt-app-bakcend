import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { OrderStatus, Prisma, TableStatus } from "@prisma/client";
import { prisma } from "./lib/prisma";

type MenuSeed = {
  category: string;
  name: string;
  description: string;
  priceMinor: number;
  photo: string;
  variants?: { name: string; priceMinor: number }[];
  addOns?: string[];
};

const menu: MenuSeed[] = [
  { category: "Small Plates", name: "Tomato Basil Bruschetta", description: "Toasted sourdough, ripe tomatoes, fresh basil and extra virgin olive oil.", priceMinor: 22900, photo: "photo-1572695157366-5e585ab2b69f" },
  { category: "Small Plates", name: "Crispy Peri Peri Fries", description: "Golden fries tossed in peri peri spice, served with a creamy garlic dip.", priceMinor: 17900, photo: "photo-1573080496219-bb080dd4f877", addOns: ["Extra Cheese", "Garlic Dip"] },
  { category: "Small Plates", name: "Garden Greek Salad", description: "Cucumber, cherry tomatoes, olives and feta with a lemon herb dressing.", priceMinor: 27900, photo: "photo-1512621776951-a57141f2eefd", addOns: ["Grilled Chicken"] },
  { category: "Small Plates", name: "Garlic Cheese Bread", description: "Oven-baked bread with roasted garlic butter, mozzarella and parsley.", priceMinor: 19900, photo: "photo-1573140247632-f8fd74997d5c", addOns: ["Extra Cheese", "Garlic Dip"] },
  { category: "Signature Mains", name: "Creamy Alfredo Pasta", description: "Penne in a silky parmesan cream sauce with roasted mushrooms and herbs.", priceMinor: 36900, photo: "photo-1473093295043-cdd812d0e601", addOns: ["Extra Cheese", "Grilled Chicken"] },
  { category: "Signature Mains", name: "Pesto Primavera", description: "Basil pesto pasta with seasonal vegetables, cherry tomatoes and parmesan.", priceMinor: 34900, photo: "photo-1551183053-bf91a1d81141", addOns: ["Extra Cheese", "Grilled Chicken"] },
  { category: "Signature Mains", name: "Classic Grilled Chicken Burger", description: "Herb-grilled chicken, crisp lettuce and house sauce in a toasted bun.", priceMinor: 32900, photo: "photo-1568901346375-23c9450c58cd", addOns: ["Extra Cheese", "Garlic Dip"] },
  { category: "Signature Mains", name: "Roasted Vegetable Bowl", description: "Roasted seasonal vegetables, quinoa and greens with a tahini lemon dressing.", priceMinor: 31900, photo: "photo-1512621776951-a57141f2eefd", addOns: ["Grilled Chicken"] },
  { category: "Wood-Fired Pizza", name: "Margherita Pizza", description: "San Marzano-style tomato sauce, fresh mozzarella and basil on a crisp crust.", priceMinor: 34900, photo: "photo-1574071318508-1cdbab80d002", variants: [{ name: "Regular 8 inch", priceMinor: 34900 }, { name: "Large 12 inch", priceMinor: 54900 }], addOns: ["Extra Cheese", "Garlic Dip"] },
  { category: "Wood-Fired Pizza", name: "Farmhouse Pizza", description: "Bell peppers, mushrooms, onions and olives with mozzarella and oregano.", priceMinor: 39900, photo: "photo-1513104890138-7c749659a591", variants: [{ name: "Regular 8 inch", priceMinor: 39900 }, { name: "Large 12 inch", priceMinor: 59900 }], addOns: ["Extra Cheese", "Grilled Chicken"] },
  { category: "Sweet Endings", name: "Chocolate Brownie", description: "Warm dark chocolate brownie with a soft centre and vanilla ice cream.", priceMinor: 21900, photo: "photo-1606313564200-e75d5e30476c", addOns: ["Vanilla Ice Cream"] },
  { category: "Sweet Endings", name: "New York Cheesecake", description: "Baked vanilla cheesecake on a buttery biscuit base with berry compote.", priceMinor: 26900, photo: "photo-1533134242443-d4fd215305ad" },
  { category: "Sweet Endings", name: "Classic Tiramisu", description: "Coffee-soaked sponge layered with mascarpone cream and dusted cocoa.", priceMinor: 28900, photo: "photo-1571877227200-a0d98ea607e9" },
  { category: "Coffee & Coolers", name: "Iced Latte", description: "Double-shot espresso over chilled milk and ice. Smooth and refreshing.", priceMinor: 18900, photo: "photo-1461023058943-07fcbe16d735", variants: [{ name: "Regular", priceMinor: 18900 }, { name: "Large", priceMinor: 23900 }], addOns: ["Vanilla Ice Cream"] },
  { category: "Coffee & Coolers", name: "Cappuccino", description: "Freshly pulled espresso with steamed milk and a thick, velvety foam.", priceMinor: 16900, photo: "photo-1572442388796-11668a67e53d" },
  { category: "Coffee & Coolers", name: "Fresh Lime Mint Cooler", description: "Fresh lime, muddled mint and sparkling soda, poured over ice.", priceMinor: 14900, photo: "photo-1621263764928-df1444c5e859" },
  { category: "Coffee & Coolers", name: "Strawberry Milkshake", description: "Strawberries blended with chilled milk and vanilla ice cream.", priceMinor: 22900, photo: "photo-1572490122747-3968b75cc699", addOns: ["Vanilla Ice Cream"] },
  { category: "Coffee & Coolers", name: "Matcha Latte", description: "A new arrival: stone-ground matcha whisked with steamed milk.", priceMinor: 21900, photo: "photo-1515823064-d6e0c04616a7" },
];

async function seedDemo() {
  const connection = new URL(process.env.DATABASE_URL!);
  const isLocalDatabase = ["localhost", "127.0.0.1", "[::1]"].includes(connection.hostname);
  assert(isLocalDatabase || process.env.ALLOW_REMOTE_DEMO_SEED === "true", "Set ALLOW_REMOTE_DEMO_SEED=true to seed the dedicated demo tenant remotely.");
  const ownerEmail = process.env.SEED_OWNER_EMAIL ?? "admin@olive-thyme-demo.example";
  const owner = await prisma.user.findFirst({
    where: { email: ownerEmail, role: "OWNER", isActive: true },
    include: { restaurant: true },
  });
  assert(owner, "The expected owner and restaurant must already exist.");
  assert(process.env.SEED_OWNER_EMAIL || owner.restaurant.email === "hello@olive-thyme-demo.example", "The expected demo owner and restaurant must already exist.");
  const restaurantId = owner.restaurantId;
  const now = new Date();
  const historyStart = new Date(now);
  historyStart.setMonth(historyStart.getMonth() - 5, 1);
  historyStart.setHours(0, 0, 0, 0);
  const prefix = "olive-thyme-demo-v1:";
  let randomState = 20261023;
  const random = () => {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 4294967296;
  };

  const result = await prisma.$transaction(async (transaction) => {
    const addOns = await Promise.all([
      { name: "Extra Cheese", priceMinor: 4900 },
      { name: "Grilled Chicken", priceMinor: 9900 },
      { name: "Garlic Dip", priceMinor: 2900 },
      { name: "Vanilla Ice Cream", priceMinor: 5900 },
    ].map((data) => transaction.addOn.upsert({ where: { restaurantId_name: { restaurantId, name: data.name } }, update: {}, create: { restaurantId, ...data } })));
    const categories = await Promise.all([...new Set(menu.map((item) => item.category))].map((name, sortOrder) =>
      transaction.menuCategory.upsert({ where: { restaurantId_name: { restaurantId, name } }, update: {}, create: { restaurantId, name, sortOrder } }),
    ));
    const items: Prisma.MenuItemGetPayload<{ include: { variants: true; addOns: { include: { addOn: true } } } }>[] = [];
    for (const [sortOrder, entry] of menu.entries()) {
      const existing = await transaction.menuItem.findFirst({ where: { restaurantId, name: entry.name }, include: { variants: true, addOns: { include: { addOn: true } } } });
      const item = existing ?? await transaction.menuItem.create({
        data: {
          restaurantId,
          categoryId: categories.find((category) => category.name === entry.category)!.id,
          name: entry.name,
          description: entry.description,
          priceMinor: entry.priceMinor,
          imageUrl: `https://images.unsplash.com/${entry.photo}?auto=format&fit=crop&w=900&q=85`,
          sortOrder,
          createdAt: historyStart,
          variants: { create: entry.variants?.map((variant, index) => ({ ...variant, sortOrder: index })) ?? [] },
          addOns: { create: (entry.addOns ?? []).map((name) => ({ addOnId: addOns.find((addOn) => addOn.name === name)!.id })) },
        },
        include: { variants: true, addOns: { include: { addOn: true } } },
      });
      if (existing) await transaction.menuItem.update({ where: { id: existing.id }, data: { createdAt: historyStart } });
      items.push(item);
    }
    const tables = await Promise.all(Array.from({ length: 8 }, (_, index) => transaction.restaurantTable.upsert({
      where: { restaurantId_number: { restaurantId, number: index + 1 } },
      update: {},
      create: { restaurantId, number: index + 1, capacity: index < 2 ? 2 : index < 6 ? 4 : 6, qrToken: randomBytes(24).toString("base64url") },
    })));
    const existingKeys = new Set((await transaction.order.findMany({ where: { restaurantId, idempotencyKey: { startsWith: prefix } }, select: { idempotencyKey: true } })).map((order) => order.idempotencyKey));
    const existingNumbers = await transaction.order.aggregate({ where: { restaurantId }, _max: { orderNumber: true } });
    let orderNumber = existingNumbers._max.orderNumber ?? 0;
    let createdOrders = 0;
    const popularPool = [8, 8, 8, 0, 1, 1, 3, 4, 4, 4, 5, 6, 6, 9, 9, 10, 11, 13, 13, 14, 15, 16, 2, 7, 12];
    const notes = [null, null, "Less spicy, please.", "Please bring drinks first.", "No onions, please.", "Sauces on the side, please."];

    const createOrder = async (key: string, status: OrderStatus, createdAt: Date, tableIndex: number) => {
      const served = status === "SERVED";
      const elapsed = Math.max(0, now.getTime() - createdAt.getTime());
      const after = (minutes: number) => new Date(createdAt.getTime() + Math.min(minutes * 60000, elapsed));
      const selected = new Set<number>();
      const lineCount = 2 + Math.floor(random() * 3);
      while (selected.size < lineCount) selected.add(popularPool[Math.floor(random() * popularPool.length)]!);
      const lines = [...selected].map((itemIndex) => {
        const item = items[itemIndex]!;
        const variant = item.variants.length ? item.variants[Math.floor(random() * item.variants.length)] : undefined;
        const quantity = random() > 0.72 ? 2 : 1;
        const addOn = item.addOns.length && random() > 0.6 ? item.addOns[Math.floor(random() * item.addOns.length)]!.addOn : undefined;
        const unitPriceMinor = variant?.priceMinor ?? item.priceMinor;
        return {
          menuItemId: item.id,
          nameSnapshot: item.name,
          variantNameSnapshot: variant?.name ?? null,
          unitPriceMinor,
          quantity,
          lineTotalMinor: (unitPriceMinor + (addOn?.priceMinor ?? 0)) * quantity,
          rating: served && random() > 0.4 ? (random() > 0.4 ? 5 : random() > 0.25 ? 4 : 3) : null,
          createdAt,
          addOns: { create: addOn ? [{ addOnId: addOn.id, nameSnapshot: addOn.name, priceMinor: addOn.priceMinor, quantity: 1, createdAt }] : [] },
        };
      });
      const subtotalMinor = lines.reduce((sum, line) => sum + line.lineTotalMinor, 0);
      const discountMinor = random() > 0.85 ? Math.round(subtotalMinor * 0.1) : 0;
      const milestones: OrderStatus[] = status === "CANCELLED" ? ["PENDING", "CANCELLED"] : ["PENDING", "CONFIRMED", "PREPARING", "READY", "SERVED"];
      const stages = milestones.slice(0, milestones.indexOf(status) + 1);
      if (existingKeys.has(key)) return;
      const order = await transaction.order.create({
        data: {
          restaurantId,
          tableId: tables[tableIndex]!.id,
          orderNumber: ++orderNumber,
          idempotencyKey: key,
          status,
          subtotalMinor,
          taxMinor: 0,
          discountMinor,
          totalMinor: subtotalMinor - discountMinor,
          rating: served && random() > 0.35 ? (random() > 0.35 ? 5 : 4) : null,
          customerNote: notes[Math.floor(random() * notes.length)],
          createdAt,
          placedAt: createdAt,
          updatedAt: after(stages.length * 5),
          confirmedAt: status !== "PENDING" && status !== "CANCELLED" ? after(2) : null,
          servedAt: served ? after(25) : null,
          cancelledAt: status === "CANCELLED" ? after(5) : null,
          items: { create: lines },
        },
      });
      await transaction.orderStatusEvent.createMany({
        data: stages.map((next, index) => ({
          orderId: order.id,
          previous: index ? stages[index - 1] : null,
          next,
          actorId: index ? owner.id : null,
          createdAt: after(index * 5),
        })),
      });
      createdOrders += 1;
    };

    for (let day = new Date(historyStart), dayIndex = 0; day <= now; day.setDate(day.getDate() + 1), dayIndex += 1) {
      const ageDays = (now.getTime() - day.getTime()) / 86400000;
      const today = day.toDateString() === now.toDateString();
      const count = ageDays < 30 ? 2 : dayIndex % 5 === 0 ? 1 : 0;
      for (let index = 0; index < count; index += 1) {
        const createdAt = new Date(day);
        if (today) {
          const available = Math.max(0, now.getTime() - day.getTime() - 3600000);
          createdAt.setTime(day.getTime() + Math.floor(available * (index + 1) / (count + 1)));
        } else {
          createdAt.setHours(11 + Math.floor(index * 10 / count), (dayIndex * 7 + index * 13) % 60, 0, 0);
        }
        await createOrder(`${prefix}${day.getFullYear()}-${day.getMonth() + 1}-${day.getDate()}:${index}`, (dayIndex + index) % 19 === 0 ? "CANCELLED" : "SERVED", createdAt, (dayIndex + index) % 7);
      }
    }
    const liveStatuses: OrderStatus[] = ["PENDING", "CONFIRMED", "PREPARING", "READY"];
    for (const [index, status] of liveStatuses.entries()) {
      const dayStart = new Date(now);
      dayStart.setHours(0, 0, 0, 0);
      const createdAt = new Date(Math.max(dayStart.getTime(), now.getTime() - (index + 1) * 6 * 60000));
      const key = `${prefix}live:${status}`;
      const wasPresent = existingKeys.has(key);
      await createOrder(key, status, createdAt, index);
      if (!wasPresent) await transaction.restaurantTable.update({ where: { id: tables[index]!.id }, data: { status: TableStatus.OCCUPIED } });
    }
    if (!existingKeys.size && tables[6]!.status === "AVAILABLE") {
      await transaction.restaurantTable.update({ where: { id: tables[6]!.id }, data: { status: "RESERVED" } });
    }
    const seededOrders = await transaction.order.findMany({ where: { restaurantId, idempotencyKey: { startsWith: prefix } }, include: { items: { include: { addOns: true } } } });
    assert(seededOrders.length > 40, "Expected a useful six-month order history.");
    assert(seededOrders.some((order) => order.status === "SERVED" && order.rating === null), "Some completed orders must remain unrated.");
    assert(seededOrders.some((order) => order.rating !== null), "Expected sample customer ratings.");
    for (const order of seededOrders) {
      assert.equal(order.subtotalMinor, order.items.reduce((sum, item) => sum + item.lineTotalMinor, 0));
      assert.equal(order.totalMinor, order.subtotalMinor + order.taxMinor - order.discountMinor);
      assert(order.createdAt <= now, "No future orders should be created.");
      for (const item of order.items) {
        assert.equal(item.lineTotalMinor, (item.unitPriceMinor + item.addOns.reduce((sum, addOn) => sum + addOn.priceMinor * addOn.quantity, 0)) * item.quantity);
        if (order.status !== "SERVED") assert.equal(item.rating, null);
      }
      if (order.status !== "SERVED") assert.equal(order.rating, null);
    }
    return { createdOrders, totalDemoOrders: seededOrders.length, menuItems: items.length, categories: categories.length, tables: tables.length, customerUrl: `${(process.env.CLIENT_CUSTOMER_URL ?? "http://localhost:5174").split(",")[0]!.replace(/\/$/, "")}/t/${tables[7]!.qrToken}` };
  }, { timeout: 120000 });
  console.log(JSON.stringify({ restaurant: owner.restaurant.name, ...result }, null, 2));
}

seedDemo().catch((error) => {
  console.error(error instanceof Error ? (process.env.SEED_DEBUG ? error.stack : error.message) : "Demo seeding failed.");
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());