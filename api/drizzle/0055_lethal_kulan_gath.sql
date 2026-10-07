CREATE TABLE "task_waits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" text NOT NULL,
	"body" text NOT NULL,
	"follow_up_date" date NOT NULL,
	"resolved_at" timestamp with time zone,
	"acknowledged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_waits_acknowledged_requires_resolved" CHECK ("task_waits"."acknowledged_at" IS NULL OR "task_waits"."resolved_at" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "task_waits" ADD CONSTRAINT "task_waits_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_task_waits_task_id" ON "task_waits" USING btree ("task_id");
