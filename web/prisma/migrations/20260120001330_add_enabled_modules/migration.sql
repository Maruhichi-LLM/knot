-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "enabledModules" TEXT[] DEFAULT ARRAY[]::TEXT[];
