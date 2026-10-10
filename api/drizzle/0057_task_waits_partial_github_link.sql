DROP INDEX "uq_task_waits_github_link_id";--> statement-breakpoint
CREATE UNIQUE INDEX "uq_task_waits_github_link_id" ON "task_waits" USING btree ("github_link_id") WHERE "resolved_at" IS NULL;
