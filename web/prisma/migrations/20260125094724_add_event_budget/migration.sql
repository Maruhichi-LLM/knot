/*
  Warnings:

  - You are about to drop the column `categoryId` on the `EventTransaction` table. All the data in the column will be lost.
  - You are about to drop the `EventTransactionCategory` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "EventTransaction" DROP CONSTRAINT "EventTransaction_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "EventTransactionCategory" DROP CONSTRAINT "EventTransactionCategory_groupId_fkey";

-- DropIndex
DROP INDEX "EventTransaction_categoryId_idx";

-- AlterTable
ALTER TABLE "EventTransaction" DROP COLUMN "categoryId",
ADD COLUMN     "accountId" INTEGER;

-- DropTable
DROP TABLE "EventTransactionCategory";

-- CreateIndex
CREATE INDEX "EventTransaction_accountId_idx" ON "EventTransaction"("accountId");

-- AddForeignKey
ALTER TABLE "EventTransaction" ADD CONSTRAINT "EventTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
