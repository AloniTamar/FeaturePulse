/*
  Warnings:

  - Added the required column `appId` to the `DailyAggregate` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "App" ADD COLUMN     "aiInsightsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "aiInsightsMode" TEXT NOT NULL DEFAULT 'nightly';

-- AlterTable
ALTER TABLE "DailyAggregate" ADD COLUMN     "appId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "AppDailyStats" (
    "appId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "dailyActiveUsers" INTEGER NOT NULL DEFAULT 0,
    "totalImpressions" INTEGER NOT NULL DEFAULT 0,
    "totalInteractions" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AppDailyStats_pkey" PRIMARY KEY ("appId","date")
);

-- CreateTable
CREATE TABLE "WeeklyAggregate" (
    "featureId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "avgInteractionRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "totalInteractions" INTEGER NOT NULL DEFAULT 0,
    "totalImpressions" INTEGER NOT NULL DEFAULT 0,
    "uniqueUsers" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WeeklyAggregate_pkey" PRIMARY KEY ("featureId","weekStart")
);

-- CreateTable
CREATE TABLE "AppInsight" (
    "appId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "bullets" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppInsight_pkey" PRIMARY KEY ("appId")
);

-- CreateIndex
CREATE INDEX "AppDailyStats_appId_date_idx" ON "AppDailyStats"("appId", "date");

-- CreateIndex
CREATE INDEX "WeeklyAggregate_featureId_weekStart_idx" ON "WeeklyAggregate"("featureId", "weekStart");

-- CreateIndex
CREATE INDEX "DailyAggregate_appId_date_idx" ON "DailyAggregate"("appId", "date");

-- AddForeignKey
ALTER TABLE "DailyAggregate" ADD CONSTRAINT "DailyAggregate_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppDailyStats" ADD CONSTRAINT "AppDailyStats_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyAggregate" ADD CONSTRAINT "WeeklyAggregate_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "Feature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppInsight" ADD CONSTRAINT "AppInsight_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;
