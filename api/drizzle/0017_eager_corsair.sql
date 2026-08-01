ALTER TABLE "oauth_tokens" DROP CONSTRAINT "oauth_tokens_refresh_metadata_required";--> statement-breakpoint
ALTER TABLE "oauth_tokens" ADD CONSTRAINT "oauth_tokens_refresh_metadata_required" CHECK ("oauth_tokens"."provider" = 'github' OR "oauth_tokens"."provider" = 'slack' OR ("oauth_tokens"."refresh_token" IS NOT NULL AND "oauth_tokens"."expires_at" IS NOT NULL));
