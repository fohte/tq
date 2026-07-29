DELETE FROM "time_blocks" WHERE "end_time" IS NULL OR "end_time" - "start_time" < INTERVAL '1 minute';--> statement-breakpoint
ALTER TABLE "time_blocks" ALTER COLUMN "end_time" SET NOT NULL;
