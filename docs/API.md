# Restaurant API

Base URL:

```text
http://localhost:4000/api/v1
```

Production base URL:

```text
https://YOUR-RENDER-SERVICE.onrender.com/api/v1
```

Interactive documentation is available at `/docs/`. The raw OpenAPI document is available at `/docs.json`.

## Conventions

- Send JSON with `Content-Type: application/json`.
- Dates are ISO 8601 strings.
- Money fields ending in `Minor` are integers in the restaurant currency. For INR, `35000` means Rs 350.00 when the UI formats paise.
- Admin routes require `Authorization: Bearer ACCESS_TOKEN`.
- Every success response uses `{ "data": ... }`, except collection responses, which use `{ "data": [], "pagination": ... }`.
- Errors use `{ "error": { "code", "message", "fields?", "requestId" } }`.
- Customer order creation requires a unique `Idempotency-Key` header.

## Authentication

### Register

`POST /auth/register`

```json
{
  "restaurantName": "Olive & Thyme",
  "restaurantEmail": "restaurant@example.com",
  "phone": "+919999999999",
  "ownerName": "Owner Name",
  "ownerEmail": "owner@example.com",
  "ownerPassword": "strong-password",
  "address": "12 Main Street",
  "city": "Mumbai"
}
```

Returns `201` with the created restaurant and owner. The password is never returned.

### Login

`POST /auth/login`

```json
{
  "email": "owner@example.com",
  "password": "strong-password"
}
```

Response:

```json
{
  "data": {
    "accessToken": "jwt",
    "refreshToken": "opaque-token",
    "user": {
      "id": "uuid",
      "name": "Owner Name",
      "email": "owner@example.com",
      "role": "OWNER",
      "restaurantId": "uuid"
    }
  }
}
```

Use `accessToken` in the `Authorization` header. Store refresh tokens in a secure, httpOnly cookie when possible. Do not expose refresh tokens in logs.

### Refresh, logout, current user

- `POST /auth/refresh` body: `{ "refreshToken": "..." }`; returns a new access and refresh token.
- `POST /auth/logout` body: `{ "refreshToken": "..." }`; returns `204`.
- `GET /auth/me`; returns the authenticated user.

## Restaurant settings

All routes require authentication. `PATCH` requires `OWNER` or `MANAGER`.

- `GET /restaurant`: returns the restaurant object.
- `PATCH /restaurant`: accepts any of `name`, `tagline`, `email`, `phone`, `address`, `city`, `currency`, `timezone`.
- `POST /restaurant/logo/upload`: multipart form field `file`; returns the updated restaurant with `logoUrl`.

## Menu

All menu routes require authentication. Create/update/delete operations require `OWNER` or `MANAGER`, except availability updates, which are available to authenticated staff.

### Categories

- `GET /menu/categories`
- `POST /menu/categories` body: `{ "name": "Starters", "sortOrder": 0 }`
- `PATCH /menu/categories/:categoryId` body: any of `name`, `sortOrder`, `isActive`
- `DELETE /menu/categories/:categoryId`: only empty categories can be deleted
- `POST /menu/categories/reorder` body: `{ "categoryIds": ["uuid", "uuid"] }`

### Add-ons

- `GET /menu/add-ons`
- `POST /menu/add-ons` body: `{ "name": "Extra Cheese", "priceMinor": 500, "isAvailable": true }`
- `PATCH /menu/add-ons/:addOnId`: accepts any of `name`, `priceMinor`, `isAvailable`
- `DELETE /menu/add-ons/:addOnId`

### Menu items

`POST /menu/items` body:

```json
{
  "name": "Chicken Tikka",
  "description": "Char-grilled chicken with spices",
  "categoryId": "category-uuid",
  "priceMinor": 35000,
  "imageUrl": "https://cdn.example.com/chicken-tikka.jpg",
  "isAvailable": true,
  "sortOrder": 0,
  "addOnIds": ["add-on-uuid"]
}
```

Endpoints:

- `GET /menu/items?categoryId=&search=&available=&page=1&pageSize=20`
- `GET /menu/items/:itemId`
- `POST /menu/items`
- `PATCH /menu/items/:itemId`: accepts the menu item fields; `addOnIds` is not changed by this endpoint.
- `DELETE /menu/items/:itemId`
- `PATCH /menu/items/:itemId/availability` body: `{ "isAvailable": false }`
- `POST /menu/items/:itemId/image/upload`: multipart form field `file`; saves the image URL to that menu item and returns the updated item, including `data.imageUrl` and `data.url`.

A menu item response includes its `category` and an `addOns` array. Customer menus include only active categories, available items, and available add-ons.

## Tables and QR codes

All routes require authentication. Mutations require `OWNER` or `MANAGER`.

- `GET /tables?search=12&status=AVAILABLE`
- `GET /tables/:tableId`
- `POST /tables` body: `{ "number": 12, "capacity": 4 }`
- `PATCH /tables/:tableId` body: any of `number`, `capacity`, `status`, `isActive`
- `DELETE /tables/:tableId`
- `POST /tables/:tableId/regenerate-qr`
- `GET /tables/:tableId/qr`: returns a QR data URL as plain text

Table responses include `qrToken` and a `qrUrl` similar to:

```text
https://YOUR-CUSTOMER-FRONTEND.vercel.app/t/TABLE_TOKEN
```

## Admin orders

All routes require authentication. Status changes require an authenticated restaurant user.

- `GET /orders?status=&search=&page=1&pageSize=20`
- `GET /orders/:orderId`
- `PATCH /orders/:orderId/status` body: `{ "status": "CONFIRMED" }`
- `POST /orders/:orderId/cancel`

Allowed status transitions:

```text
PENDING -> CONFIRMED -> PREPARING -> READY -> SERVED
PENDING -> CANCELLED
CONFIRMED -> CANCELLED
```

`SERVED` and `CANCELLED` are terminal. Invalid transitions return `409`.

## Dashboard

All routes require authentication.

- `GET /dashboard/summary`: returns pending, preparing, ready counts, today sales, today order count, and active table count.
- `GET /dashboard/sales?from=ISO_DATE&to=ISO_DATE&interval=day`: returns daily sales entries with `date`, `totalMinor`, and `orderCount`.
- `GET /dashboard/live-orders`: returns active orders.

## Public customer ordering

These routes do not require an admin token. The customer app gets `tableToken` from the QR URL `/t/:tableToken`.

### Context and menu

- `GET /public/tables/:tableToken/context`
- `GET /public/tables/:tableToken/menu`

Context response:

```json
{
  "data": {
    "restaurant": {
      "id": "uuid",
      "name": "Olive & Thyme",
      "tagline": "Kitchen",
      "currency": "INR"
    },
    "table": {
      "id": "uuid",
      "number": 12,
      "capacity": 4
    }
  }
}
```

Menu item responses contain `id`, `name`, `description`, `priceMinor`, `currency`, `imageUrl`, `category`, and `addOns`.

### Create an order

`POST /public/tables/:tableToken/orders`

Headers:

```text
Content-Type: application/json
Idempotency-Key: a-new-uuid-per-cart-submission
```

Body:

```json
{
  "items": [
    {
      "menuItemId": "menu-item-uuid",
      "quantity": 2,
      "addOnIds": ["add-on-uuid"]
    }
  ],
  "customerNote": "Less spicy"
}
```

The server loads current item/add-on prices, checks availability and ownership, calculates totals, creates historical snapshots, and marks the table occupied. Never send or trust client totals, names, or prices.

### Read an order

- `GET /public/orders/:orderId`: returns status, items, totals, table number, and timestamps.
- `GET /public/orders/:orderId/events`: Server-Sent Events stream. The event name is `ORDER_STATUS_CHANGED`; poll every 10 to 15 seconds as a fallback.

Example event:

```text
event: ORDER_STATUS_CHANGED
data: {"type":"ORDER_STATUS_CHANGED","orderId":"uuid","status":"READY","updatedAt":"2026-09-25T10:45:00.000Z"}
```

## Frontend integration sequence

1. Admin calls `/auth/login` and stores the access token in memory.
2. Admin sends `Authorization: Bearer <accessToken>` with protected API calls.
3. On `401`, call `/auth/refresh`, replace both tokens, and retry once. On a second `401`, redirect to login.
4. Customer parses `/t/:tableToken`, calls context and menu, and stores the table token in page state.
5. Cart lines are identified by `menuItemId` plus sorted `addOnIds`.
6. Customer creates an order with a newly generated idempotency key and uses the returned order ID for status tracking.
7. Admin refreshes dashboard/order data after mutations; customer listens to SSE or polls order status.
8. Use `currency` and `priceMinor` from the API; do not hard-code categories, prices, table numbers, or order numbers.

## Error handling

Handle these statuses:

- `400`: malformed request
- `401`: missing or expired authentication
- `403`: role is not allowed
- `404`: resource or table token does not exist
- `409`: duplicate/conflicting data or invalid order transition
- `422`: validation or unavailable menu data
- `429`: rate limit exceeded
- `500`: unexpected server error
- `502`/`503`: storage or dependency unavailable

Use `error.code` for logic and `error.message` for display. Include `error.requestId` when reporting a support issue.
