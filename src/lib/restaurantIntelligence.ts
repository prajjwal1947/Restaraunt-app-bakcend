type MenuProduct = {
  id: string;
  name: string;
  isAvailable: boolean;
  createdAt: Date;
};

type IntelligenceOrder = {
  createdAt: Date;
  totalMinor: number;
  rating: number | null;
  status: string;
  items: Array<{
    menuItemId: string | null;
    nameSnapshot: string;
    quantity: number;
    lineTotalMinor: number;
    rating: number | null;
  }>;
};

type ProductTotals = {
  id: string;
  name: string;
  available: boolean;
  createdDay: string;
  units7: number;
  previousUnits7: number;
  units30: number;
  revenue7Minor: number;
  revenue30Minor: number;
  ratingTotal: number;
  ratingCount: number;
  dailyUnits: Map<string, number>;
};

function shiftDay(day: string, offset: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function changePercent(current: number, previous: number) {
  return previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;
}

export function computeRestaurantIntelligence(input: {
  restaurantName: string;
  currency: string;
  timezone: string;
  menuItems: MenuProduct[];
  orders: IntelligenceOrder[];
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const dayFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: input.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const dayKey = (date: Date) => {
    const parts = dayFormatter.formatToParts(date);
    const value = (type: string) => parts.find((part) => part.type === type)!.value;
    return `${value("year")}-${value("month")}-${value("day")}`;
  };
  const today = dayKey(now);
  const yesterday = shiftDay(today, -1);
  const start7 = shiftDay(today, -7);
  const previousStart7 = shiftDay(today, -14);
  const start30 = shiftDay(today, -30);
  const historyStart = shiftDay(today, -60);
  const tomorrow = shiftDay(today, 1);
  const previousMatchingDay = shiftDay(yesterday, -7);
  const tomorrowWeekday = new Date(`${tomorrow}T12:00:00Z`).getUTCDay();
  const totals = new Map<string, ProductTotals>();
  const newProduct = (id: string, name: string, available: boolean, createdDay: string): ProductTotals => ({
    id, name, available, createdDay,
    units7: 0, previousUnits7: 0, units30: 0,
    revenue7Minor: 0, revenue30Minor: 0,
    ratingTotal: 0, ratingCount: 0,
    dailyUnits: new Map(),
  });
  for (const item of input.menuItems) {
    totals.set(item.id, newProduct(item.id, item.name, item.isAvailable, dayKey(item.createdAt)));
  }

  let revenue7Minor = 0;
  let previousRevenue7Minor = 0;
  let revenue30Minor = 0;
  let orderCount7 = 0;
  let previousOrderCount7 = 0;
  let reviewTotal = 0;
  let reviewCount = 0;
  const activityDays = new Set<string>();
  const dailySales = new Map<string, { revenueMinor: number; orders: number }>();
  const dailyProducts = new Map<string, Map<string, number>>();

  for (const order of input.orders) {
    const day = dayKey(order.createdAt);
    if (order.status === "CANCELLED" || order.createdAt > now || day < historyStart) continue;
    activityDays.add(day);
    const daily = dailySales.get(day) ?? { revenueMinor: 0, orders: 0 };
    daily.revenueMinor += order.totalMinor;
    daily.orders += 1;
    dailySales.set(day, daily);
    if (day < today && day >= start7) {
      revenue7Minor += order.totalMinor;
      orderCount7 += 1;
    } else if (day >= previousStart7 && day < start7) {
      previousRevenue7Minor += order.totalMinor;
      previousOrderCount7 += 1;
    }
    if (day >= start30 && day < today) revenue30Minor += order.totalMinor;
    if (order.rating !== null) {
      reviewTotal += order.rating;
      reviewCount += 1;
    }

    for (const line of order.items) {
      const itemId = line.menuItemId ?? `removed:${line.nameSnapshot}`;
      const item = totals.get(itemId) ?? newProduct(itemId, line.nameSnapshot, false, historyStart);
      item.dailyUnits.set(day, (item.dailyUnits.get(day) ?? 0) + line.quantity);
      if (day >= start7 && day < today) {
        item.units7 += line.quantity;
        item.revenue7Minor += line.lineTotalMinor;
      } else if (day >= previousStart7 && day < start7) {
        item.previousUnits7 += line.quantity;
      }
      if (day >= start30 && day < today) {
        item.units30 += line.quantity;
        item.revenue30Minor += line.lineTotalMinor;
      }
      if (line.rating !== null) {
        item.ratingTotal += line.rating;
        item.ratingCount += 1;
      }
      totals.set(itemId, item);
      const products = dailyProducts.get(day) ?? new Map<string, number>();
      products.set(itemId, (products.get(itemId) ?? 0) + line.lineTotalMinor);
      dailyProducts.set(day, products);
    }
  }

  const productView = (item: ProductTotals) => ({
    id: item.id,
    name: item.name,
    available: item.available,
    units7: item.units7,
    previousUnits7: item.previousUnits7,
    units30: item.units30,
    revenue7Minor: item.revenue7Minor,
    revenue30Minor: item.revenue30Minor,
    changePercent: changePercent(item.units7, item.previousUnits7),
    averageRating: item.ratingCount ? Math.round((item.ratingTotal / item.ratingCount) * 10) / 10 : null,
    ratingCount: item.ratingCount,
  });
  const products = [...totals.values()];
  const bestSellers = products.filter((item) => item.units7 > 0)
    .sort((first, second) => second.units7 - first.units7 || first.name.localeCompare(second.name))
    .slice(0, 10).map(productView);
  const mostOrdered = [...products].filter((item) => item.units30 > 0)
    .sort((first, second) => second.units30 - first.units30).slice(0, 10).map(productView);
  const leastOrdered = products.filter((item) => item.available && item.createdDay <= start30)
    .sort((first, second) => first.units30 - second.units30 || first.name.localeCompare(second.name))
    .slice(0, 5).map(productView);
  const matchingDays = [...activityDays]
    .filter((day) => day < tomorrow && new Date(`${day}T12:00:00Z`).getUTCDay() === tomorrowWeekday)
    .sort().reverse().slice(0, 6);
  const prepForecast = products.filter((item) => item.available).map((item) => {
    const sampleDates = matchingDays.filter((day) => day >= item.createdDay);
    const quantities = sampleDates.map((day) => item.dailyUnits.get(day) ?? 0);
    const average = quantities.length ? quantities.reduce((sum, quantity) => sum + quantity, 0) / quantities.length : null;
    return {
      itemId: item.id,
      name: item.name,
      date: tomorrow,
      sampleDays: quantities.length,
      sampleDates,
      averageQuantity: average === null ? null : Math.round(average * 10) / 10,
      historicalLow: quantities.length ? Math.min(...quantities) : null,
      historicalHigh: quantities.length ? Math.max(...quantities) : null,
      recommendedQuantity: quantities.length >= 3 && average !== null ? Math.ceil(average) : null,
      evidence: quantities.length >= 3 ? "weekday-average" : "insufficient-history",
    };
  }).sort((first, second) => (second.recommendedQuantity ?? -1) - (first.recommendedQuantity ?? -1));
  const productRatings = products.filter((item) => item.ratingCount > 0).map(productView)
    .sort((first, second) => second.ratingCount - first.ratingCount).slice(0, 10);
  const promotionCandidates = productRatings
    .filter((item) => item.available && item.ratingCount >= 3 && item.averageRating! >= 4 && item.units30 > 0)
    .sort((first, second) => second.averageRating! - first.averageRating! || second.units30 - first.units30)
    .slice(0, 3);
  const demandWarnings = products
    .filter((item) => item.available && item.previousUnits7 >= 5 && item.units7 <= item.previousUnits7 * 0.7)
    .sort((first, second) => (second.previousUnits7 - second.units7) - (first.previousUnits7 - first.units7))
    .slice(0, 5).map(productView);
  const yesterdaySales = dailySales.get(yesterday) ?? { revenueMinor: 0, orders: 0 };
  const comparisonSales = dailySales.get(previousMatchingDay) ?? { revenueMinor: 0, orders: 0 };
  const yesterdayProducts = dailyProducts.get(yesterday) ?? new Map();
  const comparisonProducts = dailyProducts.get(previousMatchingDay) ?? new Map();
  const productDeclines = [...comparisonProducts.entries()].map(([itemId, revenueMinor]) => ({
    name: totals.get(itemId)!.name,
    revenueDifferenceMinor: (yesterdayProducts.get(itemId) ?? 0) - revenueMinor,
  })).filter((item) => item.revenueDifferenceMinor < 0)
    .sort((first, second) => first.revenueDifferenceMinor - second.revenueDifferenceMinor).slice(0, 5);

  return {
    generatedAt: now.toISOString(),
    restaurantName: input.restaurantName,
    currency: input.currency,
    timezone: input.timezone,
    periods: { start7, end7: yesterday, start30, end30: yesterday, historyStart, forecastDate: tomorrow },
    sales: {
      revenue7Minor, previousRevenue7Minor, revenue30Minor, orderCount7, previousOrderCount7,
      averageTicket7Minor: orderCount7 ? Math.round(revenue7Minor / orderCount7) : null,
      previousAverageTicket7Minor: previousOrderCount7 ? Math.round(previousRevenue7Minor / previousOrderCount7) : null,
      changePercent: changePercent(revenue7Minor, previousRevenue7Minor),
      yesterday: {
        date: yesterday, ...yesterdaySales, comparisonDate: previousMatchingDay,
        comparisonRevenueMinor: comparisonSales.revenueMinor,
        comparisonOrders: comparisonSales.orders,
        changePercent: changePercent(yesterdaySales.revenueMinor, comparisonSales.revenueMinor),
        productDeclines,
      },
      daily: Array.from({ length: 30 }, (_, index) => {
        const day = shiftDay(start30, index);
        return { date: day, ...(dailySales.get(day) ?? { revenueMinor: 0, orders: 0 }) };
      }),
    },
    products: products.map(productView),
    bestSellers, mostOrdered, leastOrdered, prepForecast, promotionCandidates, demandWarnings,
    reviews: {
      averageRating: reviewCount ? Math.round((reviewTotal / reviewCount) * 10) / 10 : null,
      ratingCount: reviewCount,
      products: productRatings,
      periodDays: 60,
    },
    limitations: [
      "Sales comparisons use complete calendar days in the restaurant timezone; product revenue excludes order-level tax and discounts.",
      "Prep quantities round up the historical weekday average without a growth buffer. At least three observed matching trading days are required, up to six; the low/high values are observed history, not a prediction interval.",
      "Days without any recorded non-cancelled restaurant orders are excluded from prep samples. Opening hours, past stockouts and historical availability are not recorded.",
      "Low demand is a review signal, not proof of food waste or a reason to remove an item automatically. Costs, prepared portions, leftovers and inventory are not recorded, so profit and actual waste cannot be calculated.",
      "Reviews contain star ratings only, not written feedback. No rating means unknown, not zero stars.",
      "Orders do not record stable customer identities or consent-based customer profiles. Returning or lapsed customers cannot be identified from table QR tokens.",
      "Sales changes describe associations, not causes. Weather, events, promotions and footfall are not recorded.",
    ],
  };
}

export type RestaurantIntelligence = ReturnType<typeof computeRestaurantIntelligence>;