-- CreateEnum
CREATE TYPE "TodoStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE');

-- AlterEnum
ALTER TYPE "LedgerStatus" ADD VALUE 'DRAFT';

-- AlterEnum
ALTER TYPE "DocumentCategory" ADD VALUE 'MEETING_NOTE';

-- AlterTable
ALTER TABLE "Ledger" ADD COLUMN     "sourceChatMessageId" INTEGER;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "sourceChatMessageId" INTEGER;

-- CreateTable
CREATE TABLE "TodoItem" (
    "id" SERIAL NOT NULL,
    "groupId" INTEGER NOT NULL,
    "createdByMemberId" INTEGER NOT NULL,
    "assignedMemberId" INTEGER,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "status" "TodoStatus" NOT NULL DEFAULT 'TODO',
    "dueDate" TIMESTAMP(3),
    "sourceChatMessageId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TodoItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TodoItem_sourceChatMessageId_key" ON "TodoItem"("sourceChatMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "Ledger_sourceChatMessageId_key" ON "Ledger"("sourceChatMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "Document_sourceChatMessageId_key" ON "Document"("sourceChatMessageId");

-- AddForeignKey
ALTER TABLE "Ledger" ADD CONSTRAINT "Ledger_sourceChatMessageId_fkey" FOREIGN KEY ("sourceChatMessageId") REFERENCES "ChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_sourceChatMessageId_fkey" FOREIGN KEY ("sourceChatMessageId") REFERENCES "ChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoItem" ADD CONSTRAINT "TodoItem_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoItem" ADD CONSTRAINT "TodoItem_createdByMemberId_fkey" FOREIGN KEY ("createdByMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoItem" ADD CONSTRAINT "TodoItem_assignedMemberId_fkey" FOREIGN KEY ("assignedMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoItem" ADD CONSTRAINT "TodoItem_sourceChatMessageId_fkey" FOREIGN KEY ("sourceChatMessageId") REFERENCES "ChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

