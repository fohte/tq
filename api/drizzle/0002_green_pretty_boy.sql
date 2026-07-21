ALTER TABLE "oauth_tokens" ALTER COLUMN "refresh_token" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "oauth_tokens" ALTER COLUMN "expires_at" DROP NOT NULL;
