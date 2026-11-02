BEGIN;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "customerSessionId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "billedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Order_tableId_billedAt_idx"
    ON "Order"("tableId", "billedAt");

CREATE INDEX IF NOT EXISTS "Order_tableId_customerSessionId_createdAt_idx"
    ON "Order"("tableId", "customerSessionId", "createdAt");

-- Orders older than a day are treated as already billed so they do not merge into open table bills.
UPDATE "Order"
SET "billedAt" = "updatedAt"
WHERE "billedAt" IS NULL
  AND "createdAt" < NOW() - INTERVAL '1 day';

COMMIT;
