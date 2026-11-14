CREATE TABLE "UrbanPiperOrder" (
    "id" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "businessId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "externalOrderId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "statusUpdatedAt" TIMESTAMP(3),
    "payload" JSONB NOT NULL,
    "statusPayload" JSONB,
    "cancellationPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UrbanPiperOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UrbanPiperOrder_businessId_externalOrderId_key" ON "UrbanPiperOrder"("businessId", "externalOrderId");
CREATE INDEX "UrbanPiperOrder_restaurantId_createdAt_idx" ON "UrbanPiperOrder"("restaurantId", "createdAt");
ALTER TABLE "UrbanPiperOrder" ADD CONSTRAINT "UrbanPiperOrder_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;