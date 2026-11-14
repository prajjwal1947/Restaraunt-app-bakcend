# UrbanPiper integration

This backend can receive UrbanPiper order relay and order status webhooks for configured stores, list marketplace orders, and request acknowledgment, food-ready, and dispatch status changes. UrbanPiper must connect the store to Swiggy and/or Zomato separately. This is an integration foundation, not a certified or complete POS integration.

## Setup

1. Complete UrbanPiper partner onboarding and obtain a sandbox business ID, UrbanPiper store ID, API username and API key. The store ID is the numeric UrbanPiper `order.store.id`, not the merchant reference. Obtain the restaurant UUID from this backend.
2. Deploy the database migration with `npm run prisma:deploy`, after backing up the target database and checking the deployment environment.
3. Configure `URBANPIPER_STORES` in the backend's private environment. It is a JSON array, for example:

```env
URBANPIPER_STORES='[{"restaurantId":"00000000-0000-4000-8000-000000000001","businessId":"12345","storeId":"67890","webhookSecret":"replace-with-a-random-secret-at-least-32-characters","apiUsername":"your-api-username","apiKey":"your-api-key"}]'
URBANPIPER_API_BASE_URL=https://pos-int.urbanpiper.com
```

Generate a secret with `openssl rand -hex 32`. Do not commit credentials or secrets. Store mappings are managed by the deployment operator, not by restaurant users. A business/store pair must appear once; all stores in the same business must share its webhook secret. API username and key are optional for receiving orders but required to send status updates. Map every participating store to its own restaurant UUID. Restart all backend instances after changes. Use UrbanPiper's production base URL only after certification; it must be an HTTPS UrbanPiper domain.

4. Configure two webhooks **per business** in UrbanPiper Atlas or its Webhooks API, pointing to your public HTTPS backend:

| UrbanPiper event | URL |
| --- | --- |
| `order_placed` | `https://YOUR_BACKEND/api/v1/webhooks/urbanpiper/orders` |
| `order_status_update` | `https://YOUR_BACKEND/api/v1/webhooks/urbanpiper/order-status` |

For both webhooks set the custom header `x-urbanpiper-secret` to that business's configured `webhookSecret`. UrbanPiper sends `X-UPR-Biz-Id` automatically. Register each event only once per business; the store and business IDs in the request select the configured restaurant. Do not expose the secret in the webhook URL. See [UrbanPiper webhook setup](https://api-docs.urbanpiper.com/downstream/api/endpoints/setting-up-webhooks) and [event headers](https://api-docs.urbanpiper.com/downstream/api/references/webhook-event-headers).

5. Test using UrbanPiper sandbox orders, confirm the webhooks return 200, and verify both channels and status changes. Complete UrbanPiper's required certification and aggregator onboarding before using production. Monitor failed deliveries and use UrbanPiper's webhook retry process for missed orders: retries are limited and a failed order can otherwise be lost.

## Backend API

All endpoints below require the existing restaurant staff bearer token and are scoped to that token's restaurant:

- `GET /api/v1/urbanpiper/orders?page=1&pageSize=20` lists marketplace orders, newest first.
- `GET /api/v1/urbanpiper/orders/:orderId` returns a marketplace order. The ID is the backend UUID, also returned as `order_ref_id` to UrbanPiper.
- `POST /api/v1/urbanpiper/orders/:orderId/status` requests a status change. Send JSON such as `{"status":"Acknowledged","prepTimeMinutes":15}` or `{"status":"Food Ready"}`. Allowed values are `Acknowledged`, `Food Ready`, and `Dispatched`; `prepTimeMinutes` is optional and only valid for acknowledgment. Follow the platform's order and preparation-time rules.

Status requests are sent to UrbanPiper synchronously. An HTTP success from this API means UrbanPiper accepted the request, not that the locally stored status has already changed; the status webhook updates the local record. On timeout or upstream errors, check UrbanPiper and the webhook state before retrying. Status events are ordered by UrbanPiper's event timestamp; retries of an order relay return the original order reference.

Each order includes the original relay `payload` and latest `statusPayload`. A Zomato `customer_cancelled` request is stored separately in `cancellationPayload` and does not mean the order was cancelled. These payloads can contain customer personal information; restrict access, backups, logs, and retention appropriately.

## Limitations

- Marketplace orders are separate from dine-in `/orders`, table billing, and existing dashboard totals. A client must call the marketplace endpoints to show and manage them.
- Menu publishing, item and store availability, rider events, customer cancellation decisions, merchant cancellations, completion, and missed-order recovery are not implemented. Manage these through UrbanPiper until supported. Swiggy and Zomato have different cancellation rules; do not assume a cancellation request means cancellation succeeded.
- The backend does not register webhooks automatically and does not poll UrbanPiper for missing events. Configure monitoring and recovery with UrbanPiper before relying on this for live orders.
- No frontend changes are included. Sandbox and live end-to-end testing require your UrbanPiper account and configured webhook access.