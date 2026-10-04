CREATE TABLE "schedule_overrides" (
	"schedule_id" text NOT NULL,
	"occurrence_date" date NOT NULL,
	"start_time" text,
	"end_time" text,
	"skipped" boolean DEFAULT false NOT NULL,
	CONSTRAINT "schedule_overrides_schedule_date_unique" UNIQUE("schedule_id","occurrence_date"),
	CONSTRAINT "schedule_overrides_time_or_skip_check" CHECK (("schedule_overrides"."skipped" AND "schedule_overrides"."start_time" IS NULL AND "schedule_overrides"."end_time" IS NULL) OR (NOT "schedule_overrides"."skipped" AND "schedule_overrides"."start_time" IS NOT NULL AND "schedule_overrides"."end_time" IS NOT NULL)),
	CONSTRAINT "schedule_overrides_time_format_check" CHECK (("schedule_overrides"."start_time" IS NULL OR "schedule_overrides"."start_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') AND ("schedule_overrides"."end_time" IS NULL OR "schedule_overrides"."end_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'))
);
--> statement-breakpoint
ALTER TABLE "schedule_overrides" ADD CONSTRAINT "schedule_overrides_schedule_id_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_schedule_overrides_occurrence_date" ON "schedule_overrides" USING btree ("occurrence_date");
