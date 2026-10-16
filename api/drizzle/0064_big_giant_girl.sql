CREATE TABLE "schedule_reminder_deliveries" (
	"schedule_id" text NOT NULL,
	"occurrence_date" date NOT NULL,
	"remind_at" timestamp with time zone NOT NULL,
	"delivered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schedule_reminder_deliveries_schedule_id_occurrence_date_remind_at_pk" PRIMARY KEY("schedule_id","occurrence_date","remind_at")
);
--> statement-breakpoint
ALTER TABLE "schedules" ADD COLUMN "remind_before_minutes" integer;--> statement-breakpoint
ALTER TABLE "schedule_reminder_deliveries" ADD CONSTRAINT "schedule_reminder_deliveries_schedule_id_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_schedule_reminder_deliveries_delivered_at" ON "schedule_reminder_deliveries" USING btree ("delivered_at");--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_remind_before_minutes_check" CHECK ("schedules"."remind_before_minutes" BETWEEN 0 AND 1440);
