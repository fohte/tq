CREATE TABLE "task_links" (
	"id" text PRIMARY KEY NOT NULL,
	"source_task_id" text NOT NULL,
	"target_task_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_links_no_self_link" CHECK ("task_links"."source_task_id" != "task_links"."target_task_id")
);
--> statement-breakpoint
ALTER TABLE "task_links" ADD CONSTRAINT "task_links_source_task_id_tasks_id_fk" FOREIGN KEY ("source_task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_links" ADD CONSTRAINT "task_links_target_task_id_tasks_id_fk" FOREIGN KEY ("target_task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_task_links_source_target" ON "task_links" USING btree ("source_task_id","target_task_id");--> statement-breakpoint
CREATE INDEX "idx_task_links_target_task_id" ON "task_links" USING btree ("target_task_id");
