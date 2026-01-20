-- DropForeignKey
ALTER TABLE "PersonalEvent" DROP CONSTRAINT "PersonalEvent_memberId_fkey";

-- DropIndex
DROP INDEX "PersonalEvent_member_idx";

-- AlterTable
ALTER TABLE "PersonalEvent" ALTER COLUMN "startsAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "endsAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "PersonalEvent" ADD CONSTRAINT "PersonalEvent_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
