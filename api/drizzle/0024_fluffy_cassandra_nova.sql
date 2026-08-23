CREATE TABLE "agent_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"session_id" text NOT NULL,
	"context" text DEFAULT 'personal' NOT NULL,
	"cwd" text NOT NULL,
	"label" text,
	"last_message" text,
	"custom_label" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_active_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	CONSTRAINT "uq_agent_sessions_provider_session_id" UNIQUE("provider","session_id")
);
--> statement-breakpoint
CREATE INDEX "idx_agent_sessions_last_active_at" ON "agent_sessions" USING btree ("last_active_at");
