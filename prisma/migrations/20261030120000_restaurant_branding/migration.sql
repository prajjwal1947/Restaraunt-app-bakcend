CREATE TABLE "RestaurantBranding" (
    "restaurantId" UUID NOT NULL,
    "brandName" VARCHAR(60),
    "logoUrl" TEXT,
    "gradientStart" VARCHAR(7) NOT NULL DEFAULT '#e86a33',
    "gradientEnd" VARCHAR(7) NOT NULL DEFAULT '#f7c59f',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RestaurantBranding_pkey" PRIMARY KEY ("restaurantId"),
    CONSTRAINT "RestaurantBranding_restaurantId_fkey"
        FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RestaurantBranding_gradientStart_check"
        CHECK ("gradientStart" ~ '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT "RestaurantBranding_gradientEnd_check"
        CHECK ("gradientEnd" ~ '^#[0-9A-Fa-f]{6}$')
);

INSERT INTO "RestaurantBranding" ("restaurantId", "logoUrl")
SELECT "id", "logoUrl" FROM "Restaurant";