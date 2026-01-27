-- DropForeignKey
ALTER TABLE "AuditFinding" DROP CONSTRAINT IF EXISTS "AuditFinding_createdByMemberId_fkey";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'AuditFinding'
      AND column_name = 'updatedAt'
  ) THEN
    EXECUTE 'ALTER TABLE "AuditFinding" ALTER COLUMN "updatedAt" DROP DEFAULT';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'AuditLog'
      AND column_name = 'actionType'
  ) THEN
    EXECUTE 'ALTER TABLE "AuditLog" ALTER COLUMN "actionType" DROP DEFAULT';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'AuditLog'
      AND column_name = 'targetType'
  ) THEN
    EXECUTE 'ALTER TABLE "AuditLog" ALTER COLUMN "targetType" DROP DEFAULT';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'InternalControlRule'
      AND column_name = 'updatedAt'
  ) THEN
    EXECUTE 'ALTER TABLE "InternalControlRule" ALTER COLUMN "updatedAt" DROP DEFAULT';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'AuditFinding'
      AND column_name = 'createdByMemberId'
  ) THEN
    EXECUTE 'ALTER TABLE "AuditFinding" ADD CONSTRAINT "AuditFinding_createdByMemberId_fkey" FOREIGN KEY ("createdByMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE';
  END IF;
END $$;
