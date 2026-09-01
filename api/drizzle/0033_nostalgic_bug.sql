ALTER TABLE "labels" ADD COLUMN "context" text DEFAULT 'personal' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "context" text DEFAULT 'personal' NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_labels_context" ON "labels" USING btree ("context");--> statement-breakpoint
CREATE INDEX "idx_projects_context" ON "projects" USING btree ("context");
