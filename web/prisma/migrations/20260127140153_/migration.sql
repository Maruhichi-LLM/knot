-- DropForeignKey
ALTER TABLE "AuditFinding" DROP CONSTRAINT "AuditFinding_createdByMemberId_fkey";

-- AlterTable
ALTER TABLE "AuditFinding" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AuditLog" ALTER COLUMN "actionType" DROP DEFAULT,
ALTER COLUMN "targetType" DROP DEFAULT;

-- AlterTable
ALTER TABLE "InternalControlRule" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "AuditFinding" ADD CONSTRAINT "AuditFinding_createdByMemberId_fkey" FOREIGN KEY ("createdByMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
