BEGIN;

CREATE TABLE IF NOT EXISTS "MenuItemVariant" (
    "id" UUID NOT NULL,
    "menuItemId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "priceMinor" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItemVariant_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "variantNameSnapshot" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "MenuItemVariant_menuItemId_name_key"
ON "MenuItemVariant"("menuItemId", "name");

CREATE INDEX IF NOT EXISTS "MenuItemVariant_menuItemId_sortOrder_idx"
ON "MenuItemVariant"("menuItemId", "sortOrder");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'MenuItemVariant_menuItemId_fkey'
          AND conrelid = '"MenuItemVariant"'::regclass
    ) THEN
        ALTER TABLE "MenuItemVariant"
        ADD CONSTRAINT "MenuItemVariant_menuItemId_fkey"
        FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

COMMIT;