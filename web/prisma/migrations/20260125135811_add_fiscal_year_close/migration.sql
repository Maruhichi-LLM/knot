-- CreateEnum
CREATE TYPE "FiscalYearCloseStatus" AS ENUM ('DRAFT', 'CONFIRMED');

-- CreateTable
CREATE TABLE "FiscalYearClose" (
    "id" SERIAL NOT NULL,
    "groupId" INTEGER NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "FiscalYearCloseStatus" NOT NULL DEFAULT 'DRAFT',
    "totalRevenue" INTEGER NOT NULL DEFAULT 0,
    "totalExpense" INTEGER NOT NULL DEFAULT 0,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "previousCarryover" INTEGER NOT NULL DEFAULT 0,
    "nextCarryover" INTEGER NOT NULL DEFAULT 0,
    "statement" JSONB,
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalYearClose_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FiscalYearClose_groupId_status_idx" ON "FiscalYearClose"("groupId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalYearClose_groupId_fiscalYear_key" ON "FiscalYearClose"("groupId", "fiscalYear");

-- AddForeignKey
ALTER TABLE "FiscalYearClose" ADD CONSTRAINT "FiscalYearClose_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalYearClose" ADD CONSTRAINT "FiscalYearClose_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
