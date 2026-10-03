ALTER TABLE "task_github_links" DROP CONSTRAINT "uq_task_github_links_repo_number";--> statement-breakpoint
ALTER TABLE "task_github_links" ADD COLUMN "role" text;--> statement-breakpoint
ALTER TABLE "task_github_links" ADD COLUMN "notify_events" text[];--> statement-breakpoint
ALTER TABLE "task_github_links" ADD COLUMN "comments_count" integer;--> statement-breakpoint
ALTER TABLE "task_github_links" ADD COLUMN "github_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "task_github_links" ADD COLUMN "state_reason" text;--> statement-breakpoint
UPDATE "task_github_links"
SET "role" = 'subject', "notify_events" = ARRAY['closed', 'reopened', 'comments', 'other']::text[];--> statement-breakpoint
ALTER TABLE "task_github_links" ALTER COLUMN "role" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "task_github_links" ALTER COLUMN "notify_events" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_task_github_links_subject_repo_number" ON "task_github_links" USING btree ("owner","repo","number") WHERE "task_github_links"."role" = 'subject';--> statement-breakpoint
CREATE UNIQUE INDEX "uq_task_github_links_task_repo_number" ON "task_github_links" USING btree ("task_id","owner","repo","number");--> statement-breakpoint
ALTER TABLE "task_github_links" ADD CONSTRAINT "task_github_links_role_check" CHECK ("task_github_links"."role" IN ('subject', 'blocker'));--> statement-breakpoint
ALTER TABLE "task_github_links" ADD CONSTRAINT "task_github_links_notify_events_check" CHECK ("task_github_links"."notify_events" <@ ARRAY['closed', 'reopened', 'comments', 'other']::text[]);
