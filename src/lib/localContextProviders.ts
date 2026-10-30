import geohash from "ngeohash";
import { z } from "zod";
import { parseWeather, selectLocalActivities, type LocalActivityEvidence } from "./localContext";

export type ContextLocation = { latitude: number; longitude: number; contextRadiusKm: number; timezone: string };
export type ProviderResult<T> = {
  status: "ready" | "unavailable" | "not-configured" | "location-required";
  fetchedAt: string | null;
  message: string;
  data: T;
};

export async function fetchLocalWeather(location: ContextLocation, today: string, fetcher: typeof fetch = fetch): Promise<ProviderResult<ReturnType<typeof parseWeather>>> {
  const key = process.env.OPEN_METEO_API_KEY;
  const url = new URL(key ? "https://customer-api.open-meteo.com/v1/forecast" : "https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: String(location.latitude), longitude: String(location.longitude), timezone: location.timezone,
    daily: "weather_code,temperature_2m_max,precipitation_sum", past_days: "8", forecast_days: "8",
    temperature_unit: "celsius", precipitation_unit: "mm", ...(key ? { apikey: key } : {}),
  }).toString();
  const response = await fetcher(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Weather provider HTTP ${response.status}`);
  return {
    status: "ready", fetchedAt: new Date().toISOString(),
    message: "Open-Meteo modeled weather, not on-site measurements. Past dates are model estimates; future dates are forecasts.",
    data: parseWeather(await response.json(), today),
  };
}

const eventSchema = z.object({
  id: z.string(), name: z.string().max(300), url: z.string().url(),
  dates: z.object({
    start: z.object({ localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), dateTime: z.string().optional() }),
    status: z.object({ code: z.string() }).optional(),
  }),
  _embedded: z.object({ venues: z.array(z.object({
    name: z.string(),
    location: z.object({ latitude: z.string(), longitude: z.string() }).optional(),
  })) }),
});

export async function fetchNearbyEvents(
  location: ContextLocation, from: string, to: string,
  apiKey: string | undefined = process.env.TICKETMASTER_API_KEY,
  fetcher: typeof fetch = fetch,
): Promise<ProviderResult<LocalActivityEvidence[]>> {
  if (!apiKey) return { status: "not-configured", fetchedAt: null, message: "Automatic event discovery needs TICKETMASTER_API_KEY on the backend. Owner-recorded events and promotions remain available.", data: [] };
  const url = new URL("https://app.ticketmaster.com/discovery/v2/events.json");
  const bound = (day: string, offset: number) => new Date(new Date(`${day}T00:00:00Z`).getTime() + offset * 86400000).toISOString().replace(".000Z", "Z");
  url.search = new URLSearchParams({
    apikey: apiKey, geoPoint: geohash.encode(location.latitude, location.longitude),
    radius: String(location.contextRadiusKm), unit: "km", size: "100", sort: "date,asc",
    startDateTime: bound(from, -1), endDateTime: bound(to, 2), includeTBA: "no", includeTBD: "no",
  }).toString();
  const response = await fetcher(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Event provider HTTP ${response.status}`);
  const payload = z.object({
    _embedded: z.object({ events: z.array(z.unknown()) }).optional(),
    page: z.object({ totalPages: z.number().optional() }).optional(),
  }).parse(await response.json());
  const fetchedAt = new Date().toISOString();
  const candidates: LocalActivityEvidence[] = [];
  for (const raw of payload._embedded?.events ?? []) {
    const result = eventSchema.safeParse(raw);
    if (!result.success || ["cancelled", "postponed"].includes(result.data.dates.status?.code ?? "")) continue;
    const event = result.data;
    const venue = event._embedded.venues[0];
    if (!venue?.location || new URL(event.url).protocol !== "https:") continue;
    const latitude = Number(venue.location.latitude);
    const longitude = Number(venue.location.longitude);
    if (!venue.location.latitude.trim() || !venue.location.longitude.trim() || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) continue;
    let date = event.dates.start.localDate;
    if (event.dates.start.dateTime) {
      const instant = new Date(event.dates.start.dateTime);
      if (!Number.isFinite(instant.getTime())) continue;
      date = new Intl.DateTimeFormat("en-CA", { timeZone: location.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
    }
    candidates.push({
      id: `ticketmaster:${event.id}`, title: event.name, kind: "EVENT", scope: "nearby", placeName: venue.name,
      startsOn: date, endsOn: date, latitude, longitude, sourceUrl: event.url, source: "Ticketmaster", recordedAt: fetchedAt,
    });
  }
  return {
    status: "ready", fetchedAt,
    message: `Ticketmaster listings are partial, especially for past and local community events; no listings does not mean no events.${(payload.page?.totalPages ?? 0) > 1 ? " Results are limited to the first 100 provider listings." : ""}`,
    data: selectLocalActivities(candidates, location, from, to),
  };
}