-- Drop legacy audit tables
DROP TABLE IF EXISTS "AuditFinding";
DROP TABLE IF EXISTS "Audit";

-- Drop legacy indexes on AuditLog
DROP INDEX IF EXISTS "AuditLog_groupId_idx";
DROP INDEX IF EXISTS "AuditLog_memberId_idx";

-- Drop legacy enum types
DROP TYPE IF EXISTS "AuditFindingCategory";
DROP TYPE IF EXISTS "AuditFindingSeverity";
DROP TYPE IF EXISTS "AuditFindingStatus";
DROP TYPE IF EXISTS "AuditStatus";
DROP TYPE IF EXISTS "AuditType";

-- Create new enum types
CREATE TYPE "AuditActionType" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'CONFIRM', 'IMPORT', 'OTHER');
CREATE TYPE "AuditTargetType" AS ENUM ('LEDGER', 'EVENT', 'TODO', 'DOCUMENT', 'MEMBER', 'SETTING', 'AUDIT_FINDING', 'FISCAL_YEAR_CLOSE', 'EVENT_BUDGET', 'EVENT_TRANSACTION', 'EVENT_BUDGET_IMPORT', 'APPROVAL', 'ACCOUNT');
CREATE TYPE "InternalControlRuleType" AS ENUM ('SEGREGATION_OF_DUTIES', 'MULTI_APPROVAL_FOR_AMOUNT', 'NO_APPROVAL_NO_CONFIRM', 'BUDGET_OVERAGE_ALERT', 'MISSING_SOURCE_LINK');
CREATE TYPE "InternalControlSeverity" AS ENUM ('INFO', 'WARN', 'CRITICAL');
CREATE TYPE "AuditFindingCategory" AS ENUM ('FINANCIAL', 'INTERNAL_CONTROL');
CREATE TYPE "AuditFindingSeverity" AS ENUM ('INFO', 'WARN', 'CRITICAL');
CREATE TYPE "AuditFindingStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');

-- Update AuditLog table structure
ALTER TABLE "AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_groupId_fkey";
ALTER TABLE "AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_memberId_fkey";
ALTER TABLE "AuditLog" RENAME COLUMN "memberId" TO "actorMemberId";
ALTER TABLE "AuditLog" RENAME COLUMN "previousValue" TO "beforeJson";
ALTER TABLE "AuditLog" RENAME COLUMN "newValue" TO "afterJson";
ALTER TABLE "AuditLog" DROP COLUMN IF EXISTS "action";
ALTER TABLE "AuditLog" ADD COLUMN "actionType" "AuditActionType" NOT NULL DEFAULT 'OTHER';
ALTER TABLE "AuditLog" DROP COLUMN IF EXISTS "targetType";
ALTER TABLE "AuditLog" ADD COLUMN "targetType" "AuditTargetType" NOT NULL DEFAULT 'LEDGER';
ALTER TABLE "AuditLog" ADD COLUMN "sourceThreadId" INTEGER;
ALTER TABLE "AuditLog" ADD COLUMN "sourceChatMessageId" INTEGER;
ALTER TABLE "AuditLog" ADD COLUMN "userAgent" TEXT;
ALTER TABLE "AuditLog" ALTER COLUMN "targetId" DROP NOT NULL;
ALTER TABLE "AuditLog" ALTER COLUMN "beforeJson" TYPE JSONB USING "beforeJson"::jsonb;
ALTER TABLE "AuditLog" ALTER COLUMN "afterJson" TYPE JSONB USING "afterJson"::jsonb;

ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_actorMemberId_fkey" FOREIGN KEY ("actorMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_sourceThreadId_fkey" FOREIGN KEY ("sourceThreadId") REFERENCES "ChatThread"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_sourceChatMessageId_fkey" FOREIGN KEY ("sourceChatMessageId") REFERENCES "ChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "AuditLog_groupId_createdAt_idx" ON "AuditLog"("groupId", "createdAt");
CREATE INDEX "AuditLog_groupId_targetType_targetId_idx" ON "AuditLog"("groupId", "targetType", "targetId");
CREATE INDEX "AuditLog_groupId_actorMemberId_createdAt_idx" ON "AuditLog"("groupId", "actorMemberId", "createdAt");

-- Internal control rules
CREATE TABLE "InternalControlRule" (
  "id" SERIAL PRIMARY KEY,
  "groupId" INTEGER NOT NULL,
  "createdByMemberId" INTEGER,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "ruleType" "InternalControlRuleType" NOT NULL,
  "conditionJson" JSONB NOT NULL,
  "severity" "InternalControlSeverity" NOT NULL DEFAULT 'INFO',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InternalControlRule_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InternalControlRule_createdByMemberId_fkey" FOREIGN KEY ("createdByMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "InternalControlRule_groupId_isActive_idx" ON "InternalControlRule"("groupId", "isActive");

-- Audit findings
CREATE TABLE "AuditFinding" (
  "id" SERIAL PRIMARY KEY,
  "groupId" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" "AuditFindingCategory" NOT NULL,
  "severity" "AuditFindingSeverity" NOT NULL,
  "status" "AuditFindingStatus" NOT NULL DEFAULT 'OPEN',
  "logIds" INTEGER[] NOT NULL DEFAULT '{}',
  "targetRefs" JSONB,
  "assigneeMemberId" INTEGER,
  "createdByMemberId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditFinding_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AuditFinding_assigneeMemberId_fkey" FOREIGN KEY ("assigneeMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "AuditFinding_createdByMemberId_fkey" FOREIGN KEY ("createdByMemberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "AuditFinding_groupId_status_idx" ON "AuditFinding"("groupId", "status");
CREATE INDEX "AuditFinding_groupId_severity_idx" ON "AuditFinding"("groupId", "severity");
