CREATE TABLE IF NOT EXISTS "RestaurantWhatsAppConnection" (
  "restaurantId" UUID NOT NULL,
  "phoneNumberId" TEXT NOT NULL,
  "displayPhoneNumber" TEXT,
  "accessTokenEncrypted" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RestaurantWhatsAppConnection_pkey" PRIMARY KEY ("restaurantId")
);

ALTER TABLE "RestaurantWhatsAppConnection"
ADD CONSTRAINT "RestaurantWhatsAppConnection_restaurantId_fkey"
FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;