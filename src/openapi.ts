const bearer = [{ bearerAuth: [] }];

const response = (description = "Successful response") => ({
  "200": {
    description,
    content: {
      "application/json": { schema: { $ref: "#/components/schemas/Envelope" } },
    },
  },
  "401": { $ref: "#/components/responses/Unauthorized" },
  "422": { $ref: "#/components/responses/ValidationError" },
});
const secured = (
  summary: string,
  tags: string[],
  extra: Record<string, unknown> = {},
) => ({ summary, tags, security: bearer, responses: response(), ...extra });
const publicOperation = (
  summary: string,
  tags: string[],
  extra: Record<string, unknown> = {},
) => ({ summary, tags, responses: response(), ...extra });
const jsonBody = (schema: string, required = true) => ({
  required,
  content: {
    "application/json": { schema: { $ref: `#/components/schemas/${schema}` } },
  },
});
const pathParameter = (name: string, description: string) => ({
  name,
  in: "path",
  required: true,
  description,
  schema: { type: "string", format: "uuid" },
});
const tokenParameter = {
  name: "tableToken",
  in: "path",
  required: true,
  schema: { type: "string" },
};
const idParameter = (name: string) =>
  pathParameter(name, `${name} resource identifier`);

export const openapi = {
  openapi: "3.0.3",
  info: {
    title: "Olive & Thyme Restaurant API",
    version: "1.0.0",
    description:
      "Interactive API for the restaurant admin dashboard and QR-based customer ordering app. Use Authorize to paste an access token returned by /api/v1/auth/login.",
  },
  servers: [{ url: "/api/v1", description: "Current server" }],
  tags: [
    { name: "Health", description: "Service availability" },
    { name: "Authentication", description: "Owner and staff authentication" },
    { name: "Restaurant", description: "Restaurant settings" },
    { name: "Menu", description: "Categories, menu items, and add-ons" },
    { name: "Tables", description: "Tables and QR codes" },
    { name: "Orders", description: "Admin order management" },
    { name: "Dashboard", description: "Operational metrics" },
    { name: "Public ordering", description: "Customer QR ordering flow" },
  ],
  paths: {
    "/health": {
      get: {
        summary: "Check API health",
        tags: ["Health"],
        servers: [{ url: "" }],
        responses: {
          "200": {
            description: "API is running",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { status: { type: "string", example: "ok" } },
                },
              },
            },
          },
        },
      },
    },
    "/auth/register": {
      post: {
        summary: "Create a restaurant and owner",
        tags: ["Authentication"],
        requestBody: jsonBody("RegisterRequest"),
        responses: {
          "201": { description: "Restaurant and owner created" },
          "409": { $ref: "#/components/responses/Conflict" },
          "422": { $ref: "#/components/responses/ValidationError" },
        },
      },
    },
    "/auth/login": {
      post: {
        summary: "Login an owner or staff user",
        tags: ["Authentication"],
        requestBody: jsonBody("LoginRequest"),
        responses: {
          "200": { description: "Access and refresh tokens returned" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "422": { $ref: "#/components/responses/ValidationError" },
        },
      },
    },
    "/auth/refresh": {
      post: {
        summary: "Rotate a refresh token",
        tags: ["Authentication"],
        requestBody: jsonBody("RefreshRequest"),
        responses: {
          "200": { description: "New tokens returned" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/auth/logout": {
      post: {
        summary: "Revoke a refresh token",
        tags: ["Authentication"],
        requestBody: jsonBody("RefreshRequest"),
        responses: { "204": { description: "Token revoked" } },
      },
    },
    "/auth/me": { get: secured("Get the current user", ["Authentication"]) },
    "/restaurant": {
      get: secured("Get restaurant settings", ["Restaurant"]),
      patch: secured("Update restaurant settings", ["Restaurant"], {
        requestBody: jsonBody("RestaurantPatch"),
      }),
    },
    "/restaurant/logo/upload": {
      post: secured("Upload restaurant logo", ["Restaurant"], {
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: { $ref: "#/components/schemas/ImageUpload" },
            },
          },
        },
      }),
    },
    "/menu/categories": {
      get: secured("List menu categories", ["Menu"]),
      post: secured("Create a menu category", ["Menu"], {
        requestBody: jsonBody("CategoryRequest"),
      }),
    },
    "/menu/categories/{categoryId}": {
      parameters: [idParameter("categoryId")],
      patch: secured("Update a menu category", ["Menu"], {
        requestBody: jsonBody("CategoryPatch"),
      }),
      delete: secured("Delete an empty menu category", ["Menu"]),
    },
    "/menu/categories/reorder": {
      post: secured("Reorder menu categories", ["Menu"], {
        requestBody: jsonBody("ReorderRequest"),
      }),
    },
    "/menu/items": {
      get: secured("List menu items", ["Menu"], {
        parameters: [
          {
            name: "categoryId",
            in: "query",
            schema: { type: "string", format: "uuid" },
          },
          { name: "search", in: "query", schema: { type: "string" } },
          { name: "available", in: "query", schema: { type: "boolean" } },
          {
            name: "page",
            in: "query",
            schema: { type: "integer", minimum: 1, default: 1 },
          },
          {
            name: "pageSize",
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
          },
        ],
      }),
      post: secured("Create a menu item", ["Menu"], {
        requestBody: jsonBody("MenuItemRequest"),
      }),
    },
    "/menu/items/bulk": {
      post: secured("Create menu items in bulk", ["Menu"], {
        requestBody: jsonBody("BulkMenuItemsRequest"),
      }),
    },
    "/menu/items/{itemId}": {
      parameters: [idParameter("itemId")],
      get: secured("Get one menu item", ["Menu"]),
      patch: secured("Update a menu item", ["Menu"], {
        requestBody: jsonBody("MenuItemPatch"),
      }),
      delete: secured("Delete a menu item", ["Menu"]),
    },
    "/menu/items/{itemId}/availability": {
      parameters: [idParameter("itemId")],
      patch: secured("Toggle menu item availability", ["Menu"], {
        requestBody: jsonBody("AvailabilityRequest"),
      }),
    },
    "/menu/items/{itemId}/image/upload": {
      parameters: [idParameter("itemId")],
      post: secured("Upload menu item image", ["Menu"], {
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: { $ref: "#/components/schemas/ImageUpload" },
            },
          },
        },
      }),
    },
    "/menu/add-ons": {
      get: secured("List add-ons", ["Menu"]),
      post: secured("Create an add-on", ["Menu"], {
        requestBody: jsonBody("AddOnRequest"),
      }),
    },
    "/menu/add-ons/{addOnId}": {
      parameters: [idParameter("addOnId")],
      patch: secured("Update an add-on", ["Menu"], {
        requestBody: jsonBody("AddOnPatch"),
      }),
      delete: secured("Delete an add-on", ["Menu"]),
    },
    "/tables": {
      get: secured("List tables", ["Tables"], {
        parameters: [
          { name: "search", in: "query", schema: { type: "integer" } },
          {
            name: "status",
            in: "query",
            schema: { $ref: "#/components/schemas/TableStatus" },
          },
        ],
      }),
      post: secured("Create a table and QR token", ["Tables"], {
        requestBody: jsonBody("TableRequest"),
      }),
    },
    "/tables/{tableId}": {
      parameters: [idParameter("tableId")],
      get: secured("Get a table", ["Tables"]),
      patch: secured("Update a table", ["Tables"], {
        requestBody: jsonBody("TablePatch"),
      }),
      delete: secured("Delete a table", ["Tables"]),
    },
    "/tables/{tableId}/regenerate-qr": {
      parameters: [idParameter("tableId")],
      post: secured("Regenerate a table QR token", ["Tables"]),
    },
    "/tables/{tableId}/qr": {
      parameters: [idParameter("tableId")],
      get: secured("Get a QR data URL", ["Tables"]),
    },
    "/orders": {
      get: secured("List orders", ["Orders"], {
        parameters: [
          {
            name: "status",
            in: "query",
            schema: { $ref: "#/components/schemas/OrderStatus" },
          },
          { name: "search", in: "query", schema: { type: "integer" } },
          {
            name: "page",
            in: "query",
            schema: { type: "integer", default: 1 },
          },
          {
            name: "pageSize",
            in: "query",
            schema: { type: "integer", default: 20 },
          },
        ],
      }),
    },
    "/orders/{orderId}": {
      parameters: [idParameter("orderId")],
      get: secured("Get an order", ["Orders"]),
    },
    "/orders/{orderId}/status": {
      parameters: [idParameter("orderId")],
      patch: secured("Advance an order status", ["Orders"], {
        requestBody: jsonBody("StatusRequest"),
      }),
    },
    "/orders/{orderId}/cancel": {
      parameters: [idParameter("orderId")],
      post: secured("Cancel an order", ["Orders"]),
    },
    "/dashboard/summary": {
      get: secured("Get today's dashboard summary", ["Dashboard"]),
    },
    "/dashboard/sales": {
      get: secured("Get sales grouped by day", ["Dashboard"], {
        parameters: [
          {
            name: "from",
            in: "query",
            schema: { type: "string", format: "date-time" },
          },
          {
            name: "to",
            in: "query",
            schema: { type: "string", format: "date-time" },
          },
          {
            name: "interval",
            in: "query",
            schema: { type: "string", enum: ["day"] },
          },
        ],
      }),
    },
    "/dashboard/product-analytics": {
      get: secured("Get product sales and prep estimates", ["Dashboard"]),
    },
    "/dashboard/live-orders": {
      get: secured("Get active orders", ["Dashboard"]),
    },
    "/public/tables/{tableToken}/context": {
      parameters: [tokenParameter],
      get: publicOperation("Get restaurant and table context from a QR token", [
        "Public ordering",
      ]),
    },
    "/public/tables/{tableToken}/menu": {
      parameters: [tokenParameter],
      get: publicOperation("Get the available customer menu", [
        "Public ordering",
      ]),
    },
    "/public/tables/{tableToken}/trending": {
      parameters: [tokenParameter],
      get: publicOperation("Get the restaurant's most ordered available items", [
        "Public ordering",
      ]),
    },
    "/public/tables/{tableToken}/orders": {
      parameters: [tokenParameter],
      get: publicOperation("Get recent orders for a table", [
        "Public ordering",
      ]),
      post: publicOperation("Place a customer order", ["Public ordering"], {
        parameters: [
          {
            name: "Idempotency-Key",
            in: "header",
            required: true,
            schema: { type: "string", format: "uuid" },
            description:
              "Prevents duplicate orders when the request is retried.",
          },
        ],
        requestBody: jsonBody("CustomerOrderRequest"),
      }),
    },
    "/public/tables/{tableToken}/orders/{orderId}/rating": {
      parameters: [tokenParameter, idParameter("orderId")],
      post: publicOperation("Rate a served customer order", ["Public ordering"], {
        requestBody: jsonBody("OrderRatingRequest"),
      }),
    },
    "/public/tables/{tableToken}/orders/{orderId}/items/{orderItemId}/rating": {
      parameters: [
        tokenParameter,
        idParameter("orderId"),
        idParameter("orderItemId"),
      ],
      post: publicOperation("Rate a product in a served order", ["Public ordering"], {
        requestBody: jsonBody("OrderRatingRequest"),
      }),
    },
    "/public/orders/{orderId}": {
      parameters: [idParameter("orderId")],
      get: publicOperation("Get customer order status", ["Public ordering"]),
    },
    "/public/orders/{orderId}/events": {
      parameters: [idParameter("orderId")],
      get: {
        summary: "Stream order status changes",
        tags: ["Public ordering"],
        responses: {
          "200": {
            description: "Server-Sent Events stream",
            content: {
              "text/event-stream": {
                schema: {
                  type: "string",
                  example:
                    'event: ORDER_STATUS_CHANGED\\ndata: {\\"status\\":\\"READY\\"}\\n\\n',
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Paste only the accessToken from /auth/login.",
      },
    },
    responses: {
      Unauthorized: {
        description: "Authentication is required or the token is invalid.",
      },
      Conflict: { description: "The request conflicts with existing data." },
      ValidationError: { description: "Request fields are invalid." },
    },
    schemas: {
      Envelope: {
        type: "object",
        properties: {
          data: { nullable: true },
          error: { type: "object" },
          pagination: { type: "object" },
        },
      },
      RegisterRequest: {
        type: "object",
        required: [
          "restaurantName",
          "restaurantEmail",
          "ownerName",
          "ownerEmail",
          "ownerPassword",
        ],
        properties: {
          restaurantName: { type: "string", example: "Olive & Thyme" },
          restaurantEmail: {
            type: "string",
            format: "email",
            example: "restaurant@example.com",
          },
          phone: { type: "string", example: "+919999999999" },
          ownerName: { type: "string", example: "Owner Name" },
          ownerEmail: {
            type: "string",
            format: "email",
            example: "owner@example.com",
          },
          ownerPassword: {
            type: "string",
            format: "password",
            minLength: 8,
            example: "strong-password",
          },
          address: { type: "string", example: "12 Main Street" },
          city: { type: "string", example: "Mumbai" },
        },
      },
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: {
            type: "string",
            format: "email",
            example: "owner@example.com",
          },
          password: {
            type: "string",
            format: "password",
            example: "strong-password",
          },
        },
      },
      RefreshRequest: {
        type: "object",
        required: ["refreshToken"],
        properties: { refreshToken: { type: "string" } },
      },
      RestaurantPatch: {
        type: "object",
        properties: {
          name: { type: "string" },
          tagline: { type: "string" },
          email: { type: "string", format: "email" },
          phone: { type: "string" },
          address: { type: "string" },
          city: { type: "string" },
          currency: { type: "string", example: "INR" },
          timezone: { type: "string", example: "Asia/Kolkata" },
        },
      },
      CategoryRequest: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", example: "Starters" },
          sortOrder: { type: "integer", minimum: 0, default: 0 },
        },
      },
      CategoryPatch: {
        allOf: [{ $ref: "#/components/schemas/CategoryRequest" }],
        required: [],
      },
      ReorderRequest: {
        type: "object",
        required: ["categoryIds"],
        properties: {
          categoryIds: {
            type: "array",
            items: { type: "string", format: "uuid" },
          },
        },
      },
      MenuItemRequest: {
        type: "object",
        required: ["name", "categoryId", "priceMinor"],
        properties: {
          name: { type: "string", example: "Chicken Tikka" },
          description: { type: "string" },
          categoryId: { type: "string", format: "uuid" },
          priceMinor: {
            type: "integer",
            minimum: 0,
            example: 35000,
            description: "Price in minor currency units, such as paise.",
          },
          imageUrl: { type: "string", format: "uri" },
          isAvailable: { type: "boolean", default: true },
          sortOrder: { type: "integer", minimum: 0 },
          addOnIds: {
            type: "array",
            items: { type: "string", format: "uuid" },
          },
          variants: {
            type: "array",
            items: {
              type: "object",
              required: ["name", "priceMinor"],
              properties: {
                name: { type: "string", example: "Large" },
                priceMinor: { type: "integer", minimum: 0, example: 55000 },
              },
            },
          },
        },
      },
      MenuItemPatch: {
        allOf: [{ $ref: "#/components/schemas/MenuItemRequest" }],
        required: [],
      },
      BulkMenuItemsRequest: {
        type: "object",
        required: ["items"],
        properties: {
          items: {
            type: "array",
            minItems: 1,
            maxItems: 100,
            items: { $ref: "#/components/schemas/MenuItemRequest" },
          },
        },
      },
      AvailabilityRequest: {
        type: "object",
        required: ["isAvailable"],
        properties: { isAvailable: { type: "boolean" } },
      },
      AddOnRequest: {
        type: "object",
        required: ["name", "priceMinor"],
        properties: {
          name: { type: "string", example: "Extra Parmesan" },
          priceMinor: { type: "integer", minimum: 0, example: 4000 },
          isAvailable: { type: "boolean", default: true },
        },
      },
      AddOnPatch: {
        allOf: [{ $ref: "#/components/schemas/AddOnRequest" }],
        required: [],
      },
      TableRequest: {
        type: "object",
        required: ["number", "capacity"],
        properties: {
          number: { type: "integer", minimum: 1, example: 12 },
          capacity: { type: "integer", minimum: 1, example: 4 },
        },
      },
      TablePatch: {
        type: "object",
        properties: {
          number: { type: "integer", minimum: 1 },
          capacity: { type: "integer", minimum: 1 },
          status: { $ref: "#/components/schemas/TableStatus" },
          isActive: { type: "boolean" },
        },
      },
      TableStatus: {
        type: "string",
        enum: ["AVAILABLE", "OCCUPIED", "RESERVED"],
      },
      OrderStatus: {
        type: "string",
        enum: [
          "PENDING",
          "CONFIRMED",
          "PREPARING",
          "READY",
          "SERVED",
          "CANCELLED",
        ],
      },
      StatusRequest: {
        type: "object",
        required: ["status"],
        properties: { status: { $ref: "#/components/schemas/OrderStatus" } },
      },
      CustomerOrderRequest: {
        type: "object",
        required: ["items"],
        properties: {
          items: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              required: ["menuItemId", "quantity"],
              properties: {
                menuItemId: { type: "string", format: "uuid" },
                quantity: { type: "integer", minimum: 1, maximum: 99 },
                variantId: {
                  type: "string",
                  format: "uuid",
                  description: "Required when the menu item has size variants.",
                },
                addOnIds: {
                  type: "array",
                  items: { type: "string", format: "uuid" },
                },
              },
            },
          },
          customerNote: { type: "string", example: "Less spicy" },
        },
      },
      OrderRatingRequest: {
        type: "object",
        required: ["rating"],
        properties: {
          rating: { type: "integer", minimum: 1, maximum: 5, example: 5 },
        },
      },
      ImageUpload: {
        type: "object",
        required: ["file"],
        properties: { file: { type: "string", format: "binary" } },
      },
    },
  },
} as const;
