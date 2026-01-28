-- DropForeignKey
ALTER TABLE "AuditFinding" DROP CONSTRAINT IF EXISTS "AuditFinding_createdByMemberId_fkey";

-- AlterTable
ALTER TABLE "AuditFinding" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable (guard for shadow DB variations)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'AuditLog' AND column_name = 'actionType'
  ) THEN
    ALTER TABLE "AuditLog" ALTER COLUMN "actionType" DROP DEFAULT;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'AuditLog' AND column_name = 'targetType'
  ) THEN
    ALTER TABLE "AuditLog" ALTER COLUMN "targetType" DROP DEFAULT;
  END IF;
END $$;

-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "votingId" INTEGER;

-- AlterTable (guard for shadow DB variations)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'InternalControlRule'
  ) THEN
    ALTER TABLE "InternalControlRule" ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
END $$;

-- AlterTable
ALTER TABLE "TodoItem" ADD COLUMN     "sourceVotingId" INTEGER;

-- AlterTable
ALTER TABLE "Voting" ADD COLUMN     "sourceChatMessageId" INTEGER,
ADD COLUMN     "sourceThreadId" INTEGER;

-- AddForeignKey (guard for shadow DB variations)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'AuditFinding' AND column_name = 'createdByMemberId'
  ) THEN
    ALTER TABLE "AuditFinding" ADD CONSTRAINT "AuditFinding_createdByMemberId_fkey"
    FOREIGN KEY ("createdByMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_votingId_fkey" FOREIGN KEY ("votingId") REFERENCES "Voting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voting" ADD CONSTRAINT "Voting_sourceThreadId_fkey" FOREIGN KEY ("sourceThreadId") REFERENCES "ChatThread"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voting" ADD CONSTRAINT "Voting_sourceChatMessageId_fkey" FOREIGN KEY ("sourceChatMessageId") REFERENCES "ChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoItem" ADD CONSTRAINT "TodoItem_sourceVotingId_fkey" FOREIGN KEY ("sourceVotingId") REFERENCES "Voting"("id") ON DELETE SET NULL ON UPDATE CASCADE;
