-- Existing google_calendar rows predate account_id and can't be attributed
-- to a specific account, so they're dropped here; affected users must
-- re-authenticate. Other rows (github) get the '' sentinel via the
-- temporary DEFAULT below, matching the sentinel documented on
-- oauthTokens.accountId in schema.ts.
DELETE FROM "oauth_tokens" WHERE "provider" = 'google_calendar';--> statement-breakpoint
ALTER TABLE "oauth_tokens" DROP CONSTRAINT "oauth_tokens_provider_unique";--> statement-breakpoint
ALTER TABLE "oauth_tokens" ADD COLUMN "account_id" text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "oauth_tokens" ALTER COLUMN "account_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "oauth_tokens" ADD COLUMN "account_label" text;--> statement-breakpoint
ALTER TABLE "oauth_tokens" ADD CONSTRAINT "uq_oauth_tokens_provider_account_id" UNIQUE("provider","account_id");
