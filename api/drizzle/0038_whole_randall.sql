ALTER TABLE "tasks" ADD COLUMN "remind_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "idx_tasks_remind_at" ON "tasks" USING btree ("remind_at") WHERE "tasks"."remind_at" IS NOT NULL;
