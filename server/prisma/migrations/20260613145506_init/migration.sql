-- CreateTable
CREATE TABLE "App" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "packageName" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "apiKeyHash" TEXT NOT NULL,
    "ownerEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "config" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "App_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feature" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "elementType" TEXT NOT NULL,
    "resourceName" TEXT,
    "screenName" TEXT NOT NULL,
    "hierarchyPath" TEXT,
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastInteraction" TIMESTAMP(3),
    "state" TEXT NOT NULL DEFAULT 'THRIVING',
    "isIgnored" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "Feature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawEvent" (
    "id" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "sessionId" TEXT,
    "deviceId" TEXT,

    CONSTRAINT "RawEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyAggregate" (
    "featureId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "interactions" INTEGER NOT NULL DEFAULT 0,
    "uniqueUsers" INTEGER NOT NULL DEFAULT 0,
    "interactionRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,

    CONSTRAINT "DailyAggregate_pkey" PRIMARY KEY ("featureId","date")
);

-- CreateTable
CREATE TABLE "StateTransition" (
    "id" SERIAL NOT NULL,
    "featureId" TEXT NOT NULL,
    "oldState" TEXT,
    "newState" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,

    CONSTRAINT "StateTransition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "App_apiKey_key" ON "App"("apiKey");

-- CreateIndex
CREATE INDEX "Feature_appId_state_idx" ON "Feature"("appId", "state");

-- CreateIndex
CREATE INDEX "Feature_appId_screenName_idx" ON "Feature"("appId", "screenName");

-- CreateIndex
CREATE INDEX "RawEvent_featureId_timestamp_idx" ON "RawEvent"("featureId", "timestamp");

-- CreateIndex
CREATE INDEX "RawEvent_appId_timestamp_idx" ON "RawEvent"("appId", "timestamp");

-- CreateIndex
CREATE INDEX "DailyAggregate_date_idx" ON "DailyAggregate"("date");

-- CreateIndex
CREATE INDEX "StateTransition_featureId_changedAt_idx" ON "StateTransition"("featureId", "changedAt");

-- AddForeignKey
ALTER TABLE "Feature" ADD CONSTRAINT "Feature_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawEvent" ADD CONSTRAINT "RawEvent_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyAggregate" ADD CONSTRAINT "DailyAggregate_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "Feature"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StateTransition" ADD CONSTRAINT "StateTransition_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "Feature"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
