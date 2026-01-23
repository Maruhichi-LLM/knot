-- Add optional account relation to Ledger and enforce FK
ALTER TABLE "Ledger" ADD COLUMN "accountId" INTEGER;

ALTER TABLE "Ledger"
ADD CONSTRAINT "Ledger_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "Account"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
