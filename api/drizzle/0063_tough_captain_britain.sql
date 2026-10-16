CREATE TABLE "schedule_revisions" (
	"schedule_id" text NOT NULL,
	"effective_from" date NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"recurrence_rule_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schedule_revisions_schedule_id_effective_from_pk" PRIMARY KEY("schedule_id","effective_from"),
	CONSTRAINT "schedule_revisions_start_time_format_check" CHECK ("schedule_revisions"."start_time" ~ '^[0-9]{2}:[0-9]{2}$'),
	CONSTRAINT "schedule_revisions_end_time_format_check" CHECK ("schedule_revisions"."end_time" ~ '^[0-9]{2}:[0-9]{2}$')
);
--> statement-breakpoint
ALTER TABLE "schedules" DROP CONSTRAINT "schedules_recurrence_rule_id_recurrence_rules_id_fk";
--> statement-breakpoint
DROP INDEX "idx_schedules_recurrence_rule_id";--> statement-breakpoint
ALTER TABLE "schedules" ADD COLUMN "end_date" date;--> statement-breakpoint
ALTER TABLE "schedule_revisions" ADD CONSTRAINT "schedule_revisions_schedule_id_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_revisions" ADD CONSTRAINT "schedule_revisions_recurrence_rule_id_recurrence_rules_id_fk" FOREIGN KEY ("recurrence_rule_id") REFERENCES "public"."recurrence_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_schedule_revisions_recurrence_rule_id" ON "schedule_revisions" USING btree ("recurrence_rule_id");--> statement-breakpoint
INSERT INTO "schedule_revisions" (
	"schedule_id",
	"effective_from",
	"start_time",
	"end_time",
	"recurrence_rule_id",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"start_date",
	"start_time",
	"end_time",
	"recurrence_rule_id",
	"created_at",
	"updated_at"
FROM "schedules";--> statement-breakpoint
ALTER TABLE "schedules" DROP COLUMN "start_time";--> statement-breakpoint
ALTER TABLE "schedules" DROP COLUMN "end_time";--> statement-breakpoint
ALTER TABLE "schedules" DROP COLUMN "start_date";--> statement-breakpoint
ALTER TABLE "schedules" DROP COLUMN "recurrence_rule_id";
