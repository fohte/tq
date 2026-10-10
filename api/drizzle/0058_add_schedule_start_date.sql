ALTER TABLE "schedules" ADD COLUMN "start_date" date;
--> statement-breakpoint
UPDATE "schedules"
SET "start_date" = ("created_at" AT TIME ZONE 'Asia/Tokyo')::date;
--> statement-breakpoint
INSERT INTO "recurrence_rules" ("id", "type")
SELECT 'legacy-daily-' || "id", 'daily'
FROM "schedules"
WHERE "recurrence_rule_id" IS NULL;
--> statement-breakpoint
UPDATE "schedules"
SET "recurrence_rule_id" = 'legacy-daily-' || "id"
WHERE "recurrence_rule_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "schedules" ALTER COLUMN "start_date" SET NOT NULL;
