CREATE TABLE "calendar_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"oauth_token_id" text NOT NULL,
	"calendar_id" text NOT NULL,
	"display_name" text,
	"color" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_calendar_subscriptions_oauth_token_calendar" UNIQUE("oauth_token_id","calendar_id")
);
--> statement-breakpoint
ALTER TABLE "calendar_subscriptions" ADD CONSTRAINT "calendar_subscriptions_oauth_token_id_oauth_tokens_id_fk" FOREIGN KEY ("oauth_token_id") REFERENCES "public"."oauth_tokens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_calendar_subscriptions_oauth_token_id" ON "calendar_subscriptions" USING btree ("oauth_token_id");--> statement-breakpoint
-- Preserves current behavior across the deploy: every connected account
-- used to implicitly show its primary calendar's events (calendarId was
-- hardcoded to 'primary'). Without this backfill, getEvents() only fetching
-- subscribed calendars would make every existing account's events disappear
-- the moment this migration runs.
INSERT INTO "calendar_subscriptions" ("id", "oauth_token_id", "calendar_id")
SELECT gen_random_uuid()::text, "id", 'primary'
FROM "oauth_tokens"
WHERE "provider" = 'google_calendar';
