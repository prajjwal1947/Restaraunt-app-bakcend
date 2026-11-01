BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ServiceRequestType') THEN
        CREATE TYPE "ServiceRequestType" AS ENUM ('WAITER', 'BILL');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ServiceRequest" (
    "id" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "tableId" UUID NOT NULL,
    "type" "ServiceRequestType" NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ServiceRequest_restaurantId_resolvedAt_createdAt_idx"
    ON "ServiceRequest"("restaurantId", "resolvedAt", "createdAt");

CREATE INDEX IF NOT EXISTS "ServiceRequest_tableId_type_resolvedAt_idx"
    ON "ServiceRequest"("tableId", "type", "resolvedAt");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ServiceRequest_restaurantId_fkey') THEN
        ALTER TABLE "ServiceRequest"
            ADD CONSTRAINT "ServiceRequest_restaurantId_fkey"
            FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ServiceRequest_tableId_fkey') THEN
        ALTER TABLE "ServiceRequest"
            ADD CONSTRAINT "ServiceRequest_tableId_fkey"
            FOREIGN KEY ("tableId") REFERENCES "RestaurantTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ServiceRequest_resolvedById_fkey') THEN
        ALTER TABLE "ServiceRequest"
            ADD CONSTRAINT "ServiceRequest_resolvedById_fkey"
            FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

COMMIT;
