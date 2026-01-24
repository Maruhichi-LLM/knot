-- Add transactionDate column to Ledger
ALTER TABLE "Ledger"
ADD COLUMN "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
