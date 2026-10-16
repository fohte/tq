ALTER TABLE "schedule_overrides" DROP CONSTRAINT "schedule_overrides_schedule_date_unique";--> statement-breakpoint
ALTER TABLE "schedule_overrides" ADD CONSTRAINT "schedule_overrides_schedule_id_occurrence_date_pk" PRIMARY KEY("schedule_id","occurrence_date");--> statement-breakpoint
ALTER TABLE "schedule_overrides" ADD COLUMN "moved_to_date" date;--> statement-breakpoint
CREATE INDEX "idx_schedule_overrides_moved_to_date" ON "schedule_overrides" USING btree ("moved_to_date") WHERE "schedule_overrides"."moved_to_date" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "schedule_overrides" ADD CONSTRAINT "schedule_overrides_moved_to_date_check" CHECK ("schedule_overrides"."moved_to_date" IS NULL OR (NOT "schedule_overrides"."skipped" AND "schedule_overrides"."moved_to_date" <> "schedule_overrides"."occurrence_date"));
