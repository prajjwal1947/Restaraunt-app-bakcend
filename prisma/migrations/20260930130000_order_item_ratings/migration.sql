BEGIN;

ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "rating" SMALLINT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'OrderItem_rating_check'
          AND conrelid = '"OrderItem"'::regclass
    ) THEN
        ALTER TABLE "OrderItem"
        ADD CONSTRAINT "OrderItem_rating_check"
        CHECK ("rating" IS NULL OR ("rating" >= 1 AND "rating" <= 5));
    END IF;
END $$;

COMMIT;