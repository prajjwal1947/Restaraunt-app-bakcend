-- CreateTable "RestaurantOTPSettings"
CREATE TABLE "RestaurantOTPSettings" (
    "restaurantId" UUID NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantOTPSettings_pkey" PRIMARY KEY ("restaurantId")
);

-- CreateTable "StaffOTP"
CREATE TABLE "StaffOTP" (
    "id" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "otp" VARCHAR(6) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffOTP_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffOTP_restaurantId_phone_idx" ON "StaffOTP"("restaurantId", "phone");

-- CreateIndex
CREATE INDEX "StaffOTP_expiresAt_idx" ON "StaffOTP"("expiresAt");

-- AddForeignKey
ALTER TABLE "RestaurantOTPSettings" ADD CONSTRAINT "RestaurantOTPSettings_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffOTP" ADD CONSTRAINT "StaffOTP_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
