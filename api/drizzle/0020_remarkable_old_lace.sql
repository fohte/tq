CREATE TABLE "scheduling_settings" (
	"id" text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	"working_hours_start" text DEFAULT '09:00' NOT NULL,
	"working_hours_end" text DEFAULT '19:00' NOT NULL,
	"minimum_block_minutes" integer DEFAULT 30 NOT NULL,
	"auto_reschedule_on_gcal_change" boolean DEFAULT true NOT NULL,
	"default_context" text DEFAULT 'personal' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scheduling_settings_singleton_check" CHECK ("scheduling_settings"."id" = 'singleton'),
	CONSTRAINT "scheduling_settings_working_hours_order_check" CHECK ("scheduling_settings"."working_hours_start" < "scheduling_settings"."working_hours_end"),
	CONSTRAINT "scheduling_settings_minimum_block_minutes_positive_check" CHECK ("scheduling_settings"."minimum_block_minutes" > 0)
);
--> statement-breakpoint
INSERT INTO "scheduling_settings" ("id") VALUES ('singleton');
