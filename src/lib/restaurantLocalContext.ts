import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { selectLocalActivities, weatherLabel, type LocalActivityEvidence } from "./localContext";
import { fetchLocalWeather, fetchNearbyEvents, type ProviderResult } from "./localContextProviders";

type RestaurantLocation = { id: string; latitude: number | null; longitude: number | null; contextRadiusKm: number; timezone: string; city: string | null };

async function cachedProvider<T>(restaurantId: string, provider: string, cacheKey: string, empty: T, loader: () => Promise<ProviderResult<T>>) {
  const now = new Date();
  const cached = await prisma.restaurantContextCache.findUnique({ where: { restaurantId_provider: { restaurantId, provider } } });
  if (cached?.cacheKey === cacheKey && cached.expiresAt > now) return cached.payload as unknown as ProviderResult<T>;
  let result: ProviderResult<T>;
  try {
    result = await loader();
  } catch {
    result = { status: "unavailable", fetchedAt: now.toISOString(), message: `${provider} could not be retrieved. This is missing evidence, not proof of no weather or events.`, data: empty };
  }
  const data = {
    cacheKey, payload: JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue,
    fetchedAt: now, expiresAt: new Date(now.getTime() + (result.status === "unavailable" ? 5 : 30) * 60000),
  };
  await prisma.restaurantContextCache.upsert({
    where: { restaurantId_provider: { restaurantId, provider } },
    create: { restaurantId, provider, ...data }, update: data,
  });
  return result;
}

export async function recordedLocalActivities(restaurantId: string): Promise<LocalActivityEvidence[]> {
  const records = await prisma.localActivity.findMany({ where: { restaurantId }, orderBy: { startsOn: "desc" }, take: 100 });
  return records.map((record) => ({
    id: record.id, kind: record.kind, scope: record.scope, title: record.title, placeName: record.placeName,
    startsOn: record.startsOn.toISOString().slice(0, 10), endsOn: record.endsOn.toISOString().slice(0, 10),
    latitude: record.latitude, longitude: record.longitude, sourceUrl: record.sourceUrl,
    source: "Owner recorded", recordedAt: record.createdAt.toISOString(),
  }));
}

export async function loadRestaurantLocalContext(restaurant: RestaurantLocation, periods: { end7: string; forecastDate: string }) {
  const shift = (date: string, offset: number) => new Date(new Date(`${date}T00:00:00Z`).getTime() + offset * 86400000).toISOString().slice(0, 10);
  const today = shift(periods.forecastDate, -1);
  const from = shift(periods.end7, -7);
  const to = shift(today, 7);
  const recordedActivities = await recordedLocalActivities(restaurant.id);
  const missing = <T>(data: T): ProviderResult<T> => ({ status: "location-required", fetchedAt: null, message: "Save restaurant latitude and longitude in Settings to load location-based context.", data });
  let weather: Awaited<ReturnType<typeof fetchLocalWeather>> = missing([]);
  let events: Awaited<ReturnType<typeof fetchNearbyEvents>> = missing([]);
  if (restaurant.latitude !== null && restaurant.longitude !== null) {
    const location = { latitude: restaurant.latitude, longitude: restaurant.longitude, contextRadiusKm: restaurant.contextRadiusKm, timezone: restaurant.timezone };
    const cacheKey = JSON.stringify({ version: 1, ...location, from, to });
    [weather, events] = await Promise.all([
      cachedProvider(restaurant.id, "Open-Meteo", cacheKey, [], () => fetchLocalWeather(location, today)),
      process.env.TICKETMASTER_API_KEY
        ? cachedProvider(restaurant.id, "Ticketmaster", cacheKey, [], () => fetchNearbyEvents(location, from, to))
        : fetchNearbyEvents(location, from, to),
    ]);
  }
  const activities = selectLocalActivities([...recordedActivities, ...events.data], restaurant, from, to);
  return {
    location: { latitude: restaurant.latitude, longitude: restaurant.longitude, radiusKm: restaurant.contextRadiusKm, city: restaurant.city },
    period: { from, to },
    weather: { ...weather, sourceUrl: "https://open-meteo.com/", data: weather.data.map((day) => ({ ...day, conditions: weatherLabel(day.weatherCode) })) },
    events: { status: events.status, fetchedAt: events.fetchedAt, message: events.message, sourceUrl: "https://www.ticketmaster.com/" },
    activities, recordedActivities,
    limitations: [
      "Weather and nearby activity are contextual associations, not proof of why sales changed. Do not apply invented weather/event multipliers to prep quantities.",
      "Ticketmaster coverage is partial, especially for community events and past dates; recorded venue coordinates must be within the configured radius. An empty feed does not establish that no event occurred.",
      "Nearby promotions and community events are owner-recorded, not automatically verified. Dates are inclusive in the restaurant timezone; sources and recording timestamps are shown.",
      "Weather comes from model output, not on-site measurement. Past dates are model estimates and future dates are forecasts. Provider results are cached for up to 30 minutes; failures are retried after 5 minutes.",
    ],
  };
}

export type RestaurantLocalContext = Awaited<ReturnType<typeof loadRestaurantLocalContext>>;

export function describeLocalContext(context: RestaurantLocalContext, dates: string[]) {
  return dates.map((date) => {
    const weather = context.weather.data.find((day) => day.date === date);
    const activities = context.activities.filter((activity) => activity.startsOn <= date && activity.endsOn >= date);
    const weatherText = weather
      ? `Open-Meteo ${weather.evidence}: ${weather.conditions}; high ${weather.maxTemperatureC ?? "unknown"} C, precipitation ${weather.precipitationMm ?? "unknown"} mm (retrieved ${context.weather.fetchedAt}).`
      : `Weather: ${context.weather.message}`;
    return `${date}: ${weatherText}\n${activities.slice(0, 10).map((activity) => `${activity.kind === "PROMOTION" ? "Promotion" : "Event"}: ${activity.title} at ${activity.placeName}, ${activity.distanceKm} km; ${activity.source}${activity.sourceUrl ? ` (${activity.sourceUrl})` : ""}; recorded ${activity.recordedAt}.`).join("\n") || "No overlapping activity is recorded in the available sources; coverage is incomplete."}`;
  }).join("\n\n") + "\n\nThese are possible contextual factors, not demonstrated causes. Check operating hours, footfall and campaign results before attributing a sales change.";
}