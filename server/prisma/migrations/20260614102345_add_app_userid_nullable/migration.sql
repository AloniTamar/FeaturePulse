-- Add userId column as nullable first (so existing rows don't fail)
ALTER TABLE "App" ADD COLUMN "userId" TEXT;

-- Backfill userId from the User table via ownerEmail
UPDATE "App" SET "userId" = u.id FROM "User" u WHERE u.email = "App"."ownerEmail";
