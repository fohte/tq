CREATE TABLE "github_sync_rule_ignored_issues" (
	"id" text PRIMARY KEY NOT NULL,
	"rule_id" text NOT NULL,
	"owner" text NOT NULL,
	"repo" text NOT NULL,
	"number" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_github_sync_rule_ignored_issues" UNIQUE("rule_id","owner","repo","number")
);
--> statement-breakpoint
CREATE TABLE "github_sync_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"scope" text NOT NULL,
	"org" text,
	"repo" text,
	"trigger" text DEFAULT 'assigned' NOT NULL,
	"target_project_id" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"seed_ignore_on_next_sync" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "github_sync_rules_scope_target_check" CHECK (("github_sync_rules"."scope" = 'all' AND "github_sync_rules"."org" IS NULL AND "github_sync_rules"."repo" IS NULL)
        OR ("github_sync_rules"."scope" = 'org' AND "github_sync_rules"."org" IS NOT NULL AND "github_sync_rules"."repo" IS NULL)
        OR ("github_sync_rules"."scope" = 'repo' AND "github_sync_rules"."org" IS NOT NULL AND "github_sync_rules"."repo" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "github_sync_rule_ignored_issues" ADD CONSTRAINT "github_sync_rule_ignored_issues_rule_id_github_sync_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."github_sync_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_sync_rules" ADD CONSTRAINT "github_sync_rules_target_project_id_projects_id_fk" FOREIGN KEY ("target_project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_github_sync_rules_enabled" ON "github_sync_rules" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "idx_github_sync_rules_target_project_id" ON "github_sync_rules" USING btree ("target_project_id");
