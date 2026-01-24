-- Add accountingEnabled flag to AccountingSetting to keep feature parity with the UI
ALTER TABLE "AccountingSetting"
ADD COLUMN "accountingEnabled" BOOLEAN NOT NULL DEFAULT true;
