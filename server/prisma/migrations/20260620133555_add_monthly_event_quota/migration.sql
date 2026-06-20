-- AlterTable
ALTER TABLE "App" ADD COLUMN     "currentMonthEvents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "monthlyEventQuota" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "quotaResetMonth" TEXT NOT NULL DEFAULT '';
