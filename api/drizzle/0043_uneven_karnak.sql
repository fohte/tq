CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX "idx_tasks_title_trgm" ON "tasks" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_tasks_description_trgm" ON "tasks" USING gin ("description" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_task_comments_content_trgm" ON "task_comments" USING gin ("content" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_task_pages_content_trgm" ON "task_pages" USING gin ("content" gin_trgm_ops);
