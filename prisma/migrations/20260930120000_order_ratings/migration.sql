BEGIN;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "rating" SMALLINT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'Order_rating_check'
          AND conrelid = '"Order"'::regclass
    ) THEN
        ALTER TABLE "Order"
        ADD CONSTRAINT "Order_rating_check"
        CHECK ("rating" IS NULL OR ("rating" >= 1 AND "rating" <= 5));
    END IF;
END $$;

COMMIT;