CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "AnalyticsContextChunk" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "restaurantId" UUID NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(768),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnalyticsContextChunk_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AnalyticsContextChunk_restaurantId_fkey"
        FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AnalyticsContextChunk_restaurantId_sourceKey_key"
    ON "AnalyticsContextChunk"("restaurantId", "sourceKey");
CREATE INDEX "AnalyticsContextChunk_embedding_hnsw_idx"
    ON "AnalyticsContextChunk" USING hnsw ("embedding" vector_cosine_ops);

CREATE TABLE "AnalyticsChatMessage" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "restaurantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnalyticsChatMessage_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AnalyticsChatMessage_role_check" CHECK ("role" IN ('user', 'assistant')),
    CONSTRAINT "AnalyticsChatMessage_restaurantId_fkey"
        FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AnalyticsChatMessage_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "AnalyticsChatMessage_restaurantId_userId_createdAt_idx"
    ON "AnalyticsChatMessage"("restaurantId", "userId", "createdAt");