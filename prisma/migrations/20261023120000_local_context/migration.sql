ALTER TABLE "Restaurant"
    ADD COLUMN "latitude" DOUBLE PRECISION,
    ADD COLUMN "longitude" DOUBLE PRECISION,
    ADD COLUMN "contextRadiusKm" INTEGER NOT NULL DEFAULT 3,
    ADD CONSTRAINT "Restaurant_location_check" CHECK (
        ("latitude" IS NULL AND "longitude" IS NULL) OR
        ("latitude" IS NOT NULL AND "longitude" IS NOT NULL AND "latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180)
    ),
    ADD CONSTRAINT "Restaurant_contextRadius_check" CHECK ("contextRadiusKm" BETWEEN 1 AND 50);

CREATE TABLE "LocalActivity" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "restaurantId" UUID NOT NULL REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "kind" TEXT NOT NULL CHECK ("kind" IN ('EVENT', 'PROMOTION')),
    "scope" TEXT NOT NULL CHECK ("scope" IN ('restaurant', 'nearby')),
    "title" TEXT NOT NULL,
    "placeName" TEXT NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("id"),
    CONSTRAINT "LocalActivity_dates_check" CHECK ("startsOn" <= "endsOn"),
    CONSTRAINT "LocalActivity_location_check" CHECK (
        ("latitude" IS NULL AND "longitude" IS NULL AND "scope" = 'restaurant') OR
        ("latitude" IS NOT NULL AND "longitude" IS NOT NULL AND "latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180)
    )
);
CREATE INDEX "LocalActivity_restaurantId_startsOn_endsOn_idx" ON "LocalActivity"("restaurantId", "startsOn", "endsOn");

CREATE TABLE "RestaurantContextCache" (
    "restaurantId" UUID NOT NULL REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "provider" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    PRIMARY KEY ("restaurantId", "provider")
);