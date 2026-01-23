-- CreateEnum
CREATE TYPE "ThreadSourceType" AS ENUM ('TODO', 'EVENT', 'ACCOUNTING', 'DOCUMENT', 'FREE');

-- CreateEnum
CREATE TYPE "ThreadStatus" AS ENUM ('OPEN', 'CLOSED');

-- AlterTable
ALTER TABLE "ChatThread"
    ADD COLUMN     "title" TEXT NOT NULL DEFAULT 'FREE Thread',
    ADD COLUMN     "sourceType" "ThreadSourceType" NOT NULL DEFAULT 'FREE',
    ADD COLUMN     "sourceId" INTEGER,
    ADD COLUMN     "status" "ThreadStatus" NOT NULL DEFAULT 'OPEN',
    ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Ensure defaults are only used for existing rows
ALTER TABLE "ChatThread"
    ALTER COLUMN "title" DROP DEFAULT,
    ALTER COLUMN "sourceType" DROP DEFAULT;

-- Drop legacy columns
ALTER TABLE "ChatThread"
    DROP COLUMN "scopeType",
    DROP COLUMN "scopeId";

-- CreateIndex
CREATE INDEX "ChatThread_groupId_status_idx" ON "ChatThread"("groupId", "status");

-- CreateIndex
CREATE INDEX "ChatThread_groupId_sourceType_sourceId_idx" ON "ChatThread"("groupId", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "ChatMessage_threadId_createdAt_idx" ON "ChatMessage"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_authorId_createdAt_idx" ON "ChatMessage"("authorId", "createdAt");

-- AlterTable
ALTER TABLE "TodoItem"
    ADD COLUMN     "sourceThreadId" INTEGER;

-- CreateIndex
CREATE INDEX "TodoItem_sourceThreadId_idx" ON "TodoItem"("sourceThreadId");

-- CreateIndex
CREATE INDEX "TodoItem_sourceChatMessageId_idx" ON "TodoItem"("sourceChatMessageId");

-- AlterTable
ALTER TABLE "Ledger"
    ADD COLUMN     "sourceThreadId" INTEGER;

-- CreateIndex
CREATE INDEX "Ledger_sourceThreadId_idx" ON "Ledger"("sourceThreadId");

-- AlterTable
ALTER TABLE "Document"
    ADD COLUMN     "sourceThreadId" INTEGER;

-- CreateIndex
CREATE INDEX "Document_sourceThreadId_idx" ON "Document"("sourceThreadId");

-- AddForeignKey
ALTER TABLE "TodoItem" ADD CONSTRAINT "TodoItem_sourceThreadId_fkey" FOREIGN KEY ("sourceThreadId") REFERENCES "ChatThread"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ledger" ADD CONSTRAINT "Ledger_sourceThreadId_fkey" FOREIGN KEY ("sourceThreadId") REFERENCES "ChatThread"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_sourceThreadId_fkey" FOREIGN KEY ("sourceThreadId") REFERENCES "ChatThread"("id") ON DELETE SET NULL ON UPDATE CASCADE;
