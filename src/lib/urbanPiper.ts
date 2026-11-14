import { z } from "zod";
import { timingSafeEqual } from "node:crypto";
import { HttpError } from "./http";

const externalId = z.union([z.string().regex(/^\d+$/), z.number().int().nonnegative().safe()]).transform(String);

const relaySchema = z.object({
  order: z.object({
    details: z.object({
      id: externalId,
      biz_id: externalId,
      channel: z.string().trim().min(1),
      order_state: z.string().trim().min(1),
    }).passthrough(),
    store: z.object({ id: externalId }).passthrough(),
    items: z.array(z.unknown()),
  }).passthrough(),
}).passthrough();

export const parseUrbanPiperOrder = (body: unknown) => relaySchema.safeParse(body);

const statusSchema = z.object({
  order_id: externalId,
  store_upipr_id: externalId,
  new_state: z.string().trim().min(1),
  timestamp_unix: z.number().int().nonnegative().safe().max(8640000000000000),
}).passthrough();

export const parseUrbanPiperStatus = (body: unknown) => statusSchema.safeParse(body);

const mappingSchema = z.array(z.object({
  restaurantId: z.uuid(),
  businessId: z.string().regex(/^\d+$/),
  storeId: z.string().regex(/^\d+$/),
  webhookSecret: z.string().min(32),
  apiUsername: z.string().min(1).optional(),
  apiKey: z.string().min(1).optional(),
})).min(1);

export const urbanPiperMappings = () => {
  try {
    const mappings = mappingSchema.parse(JSON.parse(process.env.URBANPIPER_STORES ?? ""));
    const keys = mappings.map((mapping) => JSON.stringify([mapping.businessId, mapping.storeId]));
    if (new Set(keys).size !== keys.length) throw new Error("Duplicate stores");
    const businessSecrets = new Map<string, string>();
    for (const mapping of mappings) {
      if (businessSecrets.has(mapping.businessId) && businessSecrets.get(mapping.businessId) !== mapping.webhookSecret) throw new Error("Conflicting webhook secrets");
      businessSecrets.set(mapping.businessId, mapping.webhookSecret);
    }
    return mappings;
  } catch {
    throw new HttpError(503, "URBANPIPER_NOT_CONFIGURED", "UrbanPiper store mappings are not configured correctly.");
  }
};

export const matchUrbanPiperStore = (businessId: string, storeId: string, suppliedSecret: string | undefined) => {
  const mapping = urbanPiperMappings().find((item) => item.businessId === businessId && item.storeId === storeId);
  const expected = Buffer.from(mapping?.webhookSecret ?? "");
  const received = Buffer.from(suppliedSecret ?? "");
  if (!mapping || expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw new HttpError(401, "URBANPIPER_UNAUTHORIZED", "Invalid UrbanPiper webhook credentials or store.");
  }
  return mapping;
};

export const sendUrbanPiperStatus = async (mapping: ReturnType<typeof urbanPiperMappings>[number], orderId: string, status: string, prepTime?: number) => {
  if (!mapping.apiUsername || !mapping.apiKey) throw new HttpError(503, "URBANPIPER_API_NOT_CONFIGURED", "UrbanPiper API credentials are not configured.");
  let baseUrl: URL;
  try {
    baseUrl = new URL(process.env.URBANPIPER_API_BASE_URL ?? "https://pos-int.urbanpiper.com");
    if (baseUrl.protocol !== "https:" || (baseUrl.hostname !== "urbanpiper.com" && !baseUrl.hostname.endsWith(".urbanpiper.com")) || baseUrl.username || baseUrl.password || baseUrl.port || baseUrl.pathname !== "/" || baseUrl.search || baseUrl.hash) throw new Error("Invalid API URL");
  } catch {
    throw new HttpError(503, "URBANPIPER_API_NOT_CONFIGURED", "UrbanPiper API base URL is invalid.");
  }
  let result: Response;
  try {
    result = await fetch(new URL(`/external/api/v1/orders/${encodeURIComponent(orderId)}/status/`, baseUrl), {
      method: "PUT",
      headers: { Authorization: `apikey ${mapping.apiUsername}:${mapping.apiKey}`, "X-UPR-Biz-Id": mapping.businessId, "Content-Type": "application/json" },
      body: JSON.stringify({ new_status: status, ...(prepTime === undefined ? {} : { extra: { prep_time_mins: prepTime } }) }),
      signal: AbortSignal.timeout(10000),
      redirect: "error",
    });
  } catch {
    throw new HttpError(502, "URBANPIPER_UNAVAILABLE", "UrbanPiper could not be reached. Check the order status before retrying.");
  }
  if (!result.ok) throw new HttpError(502, "URBANPIPER_STATUS_REJECTED", `UrbanPiper rejected the status update (HTTP ${result.status}).`);
  let payload: unknown;
  try {
    payload = await result.json();
  } catch { payload = null; }
  if (payload && typeof payload === "object" && "status" in payload && payload.status === "error") {
    throw new HttpError(502, "URBANPIPER_STATUS_REJECTED", "UrbanPiper did not confirm the status update. Check the order status before retrying.");
  }
};