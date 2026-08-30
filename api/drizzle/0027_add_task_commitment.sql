ALTER TABLE "tasks" ADD COLUMN "commitment" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_tasks_commitment" ON "tasks" USING btree ("commitment");
