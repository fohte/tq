ALTER TABLE "task_waits" ALTER COLUMN "body" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "task_waits" ADD COLUMN "github_link_id" text;--> statement-breakpoint
ALTER TABLE "task_waits" ADD CONSTRAINT "task_waits_github_link_id_task_github_links_id_fk" FOREIGN KEY ("github_link_id") REFERENCES "public"."task_github_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_task_waits_github_link_id" ON "task_waits" USING btree ("github_link_id") WHERE "task_waits"."resolved_at" IS NULL;--> statement-breakpoint
ALTER TABLE "task_waits" ADD CONSTRAINT "task_waits_body_or_github_link_check" CHECK ("task_waits"."body" IS NOT NULL OR "task_waits"."github_link_id" IS NOT NULL);
