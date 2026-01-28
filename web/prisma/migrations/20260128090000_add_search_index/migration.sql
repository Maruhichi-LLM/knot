-- Create SearchIndex table for cross-module search
CREATE TABLE "SearchIndex" (
  "id" SERIAL PRIMARY KEY,
  "groupId" INTEGER NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" INTEGER NOT NULL,
  "title" TEXT,
  "content" TEXT,
  "urlPath" TEXT NOT NULL,
  "threadId" INTEGER,
  "eventId" INTEGER,
  "fiscalYear" INTEGER,
  "occurredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SearchIndex_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SearchIndex_entityType_entityId_groupId_key" ON "SearchIndex"("entityType", "entityId", "groupId");
CREATE INDEX "SearchIndex_groupId_idx" ON "SearchIndex"("groupId");
CREATE INDEX "SearchIndex_entityType_idx" ON "SearchIndex"("entityType");
CREATE INDEX "SearchIndex_occurredAt_idx" ON "SearchIndex"("occurredAt");
CREATE INDEX "SearchIndex_threadId_idx" ON "SearchIndex"("threadId");
CREATE INDEX "SearchIndex_eventId_idx" ON "SearchIndex"("eventId");
CREATE INDEX "SearchIndex_fiscalYear_idx" ON "SearchIndex"("fiscalYear");

-- Full text search vector (simple config for now; consider pg_trgm or language-specific dictionaries later)
ALTER TABLE "SearchIndex"
  ADD COLUMN "search_vector" tsvector GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce("title", '') || ' ' || coalesce("content", ''))
  ) STORED;

CREATE INDEX "SearchIndex_search_vector_gin" ON "SearchIndex" USING GIN ("search_vector");
