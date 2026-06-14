-- Make userId non-null now that all rows are backfilled
ALTER TABLE "App" ALTER COLUMN "userId" SET NOT NULL;

-- Add the FK constraint
ALTER TABLE "App" ADD CONSTRAINT "App_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop ownerEmail
ALTER TABLE "App" DROP COLUMN "ownerEmail";

-- Add cascade deletes for all child relations (Prisma defaults to RESTRICT)
ALTER TABLE "Feature"
  DROP CONSTRAINT "Feature_appId_fkey",
  ADD CONSTRAINT "Feature_appId_fkey"
    FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RawEvent"
  DROP CONSTRAINT "RawEvent_appId_fkey",
  ADD CONSTRAINT "RawEvent_appId_fkey"
    FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DailyAggregate"
  DROP CONSTRAINT "DailyAggregate_featureId_fkey",
  ADD CONSTRAINT "DailyAggregate_featureId_fkey"
    FOREIGN KEY ("featureId") REFERENCES "Feature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StateTransition"
  DROP CONSTRAINT "StateTransition_featureId_fkey",
  ADD CONSTRAINT "StateTransition_featureId_fkey"
    FOREIGN KEY ("featureId") REFERENCES "Feature"("id") ON DELETE CASCADE ON UPDATE CASCADE;
