-- Create personal events table for member-specific schedules
CREATE TABLE "PersonalEvent" (
  "id" SERIAL PRIMARY KEY,
  "memberId" INTEGER NOT NULL REFERENCES "Member"(id) ON DELETE CASCADE,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "location" TEXT,
  "startsAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  "endsAt" TIMESTAMP WITH TIME ZONE,
  "color" TEXT NOT NULL DEFAULT 'sky',
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX "PersonalEvent_member_idx" ON "PersonalEvent"("memberId", "startsAt");

-- Ensure existing groups have Knot Calendar enabled
UPDATE "Group"
SET "enabledModules" = array_append("enabledModules", 'calendar')
WHERE NOT ('calendar' = ANY("enabledModules"));
