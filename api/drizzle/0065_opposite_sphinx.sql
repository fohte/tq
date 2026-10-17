CREATE TABLE "schedule_constraint_weekdays" (
	"schedule_id" text NOT NULL,
	"day_of_week" integer NOT NULL,
	"preference" text NOT NULL,
	CONSTRAINT "schedule_constraint_weekdays_schedule_id_day_of_week_pk" PRIMARY KEY("schedule_id","day_of_week"),
	CONSTRAINT "schedule_constraint_weekdays_day_of_week_check" CHECK ("schedule_constraint_weekdays"."day_of_week" BETWEEN 0 AND 6),
	CONSTRAINT "schedule_constraint_weekdays_preference_check" CHECK ("schedule_constraint_weekdays"."preference" IN ('preferred', 'if_free', 'reserve', 'excluded'))
);
--> statement-breakpoint
CREATE TABLE "schedule_constraints" (
	"schedule_id" text PRIMARY KEY NOT NULL,
	"weekly_min" integer,
	"weekly_max" integer,
	"weekly_target" integer,
	"max_consecutive_days" integer,
	"window_start" text,
	"window_end" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schedule_constraints_weekly_min_check" CHECK ("schedule_constraints"."weekly_min" >= 0),
	CONSTRAINT "schedule_constraints_weekly_max_check" CHECK ("schedule_constraints"."weekly_max" <= 7),
	CONSTRAINT "schedule_constraints_weekly_range_check" CHECK ("schedule_constraints"."weekly_min" <= "schedule_constraints"."weekly_max"),
	CONSTRAINT "schedule_constraints_weekly_target_check" CHECK ("schedule_constraints"."weekly_target" BETWEEN coalesce("schedule_constraints"."weekly_min", 0) AND coalesce("schedule_constraints"."weekly_max", 7)),
	CONSTRAINT "schedule_constraints_max_consecutive_days_check" CHECK ("schedule_constraints"."max_consecutive_days" >= 1),
	CONSTRAINT "schedule_constraints_window_pair_check" CHECK (("schedule_constraints"."window_start" IS NULL) = ("schedule_constraints"."window_end" IS NULL)),
	CONSTRAINT "schedule_constraints_window_start_format_check" CHECK ("schedule_constraints"."window_start" IS NULL OR "schedule_constraints"."window_start" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
	CONSTRAINT "schedule_constraints_window_end_format_check" CHECK ("schedule_constraints"."window_end" IS NULL OR "schedule_constraints"."window_end" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);
--> statement-breakpoint
ALTER TABLE "schedule_constraint_weekdays" ADD CONSTRAINT "schedule_constraint_weekdays_constraint_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedule_constraints"("schedule_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_constraints" ADD CONSTRAINT "schedule_constraints_schedule_id_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE cascade ON UPDATE no action;
