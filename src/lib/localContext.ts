import { z } from "zod";

const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Enter a valid calendar date.");
const latitudeSchema = z.number().finite().min(-90).max(90).nullable();
const longitudeSchema = z.number().finite().min(-180).max(180).nullable();

export const locationSchema = z.object({
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  contextRadiusKm: z.number().int().min(1).max(50),
}).refine((value) => (value.latitude === null) === (value.longitude === null), "Both coordinates are required.");

export const activitySchema = z.object({
  kind: z.enum(["EVENT", "PROMOTION"]),
  scope: z.enum(["restaurant", "nearby"]),
  title: z.string().trim().min(1).max(160),
  placeName: z.string().trim().min(1).max(160),
  startsOn: daySchema,
  endsOn: daySchema,
  latitude: latitudeSchema.default(null),
  longitude: longitudeSchema.default(null),
  sourceUrl: z.string().url().max(2000).refine((value) => new URL(value).protocol === "https:", "Use an HTTPS source link.").nullable().default(null),
}).refine((value) => value.endsOn >= value.startsOn, "End date must not precede the start date.")
  .refine((value) => (value.latitude === null) === (value.longitude === null), "Both venue coordinates are required.")
  .refine((value) => value.scope !== "nearby" || value.latitude !== null, "Nearby places need coordinates.");

export type LocalActivityEvidence = {
  id: string;
  kind: string;
  scope: string;
  title: string;
  placeName: string;
  startsOn: string;
  endsOn: string;
  latitude: number | null;
  longitude: number | null;
  sourceUrl: string | null;
  source: string;
  recordedAt: string;
};

export function distanceKm(first: { latitude: number; longitude: number }, second: { latitude: number; longitude: number }) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDifference = radians(second.latitude - first.latitude);
  const longitudeDifference = radians(second.longitude - first.longitude);
  const haversine = Math.sin(latitudeDifference / 2) ** 2
    + Math.cos(radians(first.latitude)) * Math.cos(radians(second.latitude)) * Math.sin(longitudeDifference / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(Math.min(1, haversine)), Math.sqrt(Math.max(0, 1 - haversine)));
}

export function selectLocalActivities(
  activities: LocalActivityEvidence[],
  location: { latitude: number | null; longitude: number | null; contextRadiusKm: number },
  from: string,
  to: string,
) {
  return activities.flatMap((activity) => {
    if (activity.endsOn < from || activity.startsOn > to) return [];
    if (activity.scope === "restaurant") return [{ ...activity, distanceKm: 0 }];
    if (location.latitude === null || location.longitude === null || activity.latitude === null || activity.longitude === null) return [];
    const distance = distanceKm({ latitude: location.latitude, longitude: location.longitude }, { latitude: activity.latitude, longitude: activity.longitude });
    return distance <= location.contextRadiusKm ? [{ ...activity, distanceKm: Math.round(distance * 100) / 100 }] : [];
  }).sort((first, second) => first.startsOn.localeCompare(second.startsOn) || first.distanceKm - second.distanceKm);
}

export const weatherResponseSchema = z.object({
  daily: z.object({
    time: z.array(daySchema),
    temperature_2m_max: z.array(z.number().finite().nullable()),
    precipitation_sum: z.array(z.number().finite().nonnegative().nullable()),
    weather_code: z.array(z.number().int().nullable()),
  }).refine((daily) => [daily.temperature_2m_max, daily.precipitation_sum, daily.weather_code].every((values) => values.length === daily.time.length), "Incomplete daily weather data."),
});

export function parseWeather(payload: unknown, today: string) {
  const { daily } = weatherResponseSchema.parse(payload);
  return daily.time.map((date, index) => ({
    date,
    maxTemperatureC: daily.temperature_2m_max[index],
    precipitationMm: daily.precipitation_sum[index],
    weatherCode: daily.weather_code[index],
    evidence: date < today ? "past-model-estimate" : "forecast",
  }));
}

export function weatherLabel(code: number | null) {
  if (code === null) return "Conditions unavailable";
  if (code === 0) return "Clear sky";
  if (code <= 3) return "Cloudy";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 57) return "Drizzle";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "Rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "Snow";
  if (code >= 95 && code <= 99) return "Thunderstorm";
  return "Other conditions";
}