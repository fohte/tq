CREATE TABLE "task_queues" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"period_unit" text,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_queues_key_unique" UNIQUE("key"),
	CONSTRAINT "task_queues_period_unit_check" CHECK ("task_queues"."period_unit" IS NULL OR "task_queues"."period_unit" IN ('day', 'week', 'month'))
);
--> statement-breakpoint
ALTER TABLE "today_tasks" RENAME TO "task_queue_items";--> statement-breakpoint
ALTER TABLE "task_queue_items" RENAME COLUMN "date" TO "period_start";--> statement-breakpoint
ALTER TABLE "task_queue_items" RENAME CONSTRAINT "today_tasks_pkey" TO "task_queue_items_pkey";--> statement-breakpoint
ALTER TABLE "task_queue_items" RENAME CONSTRAINT "today_tasks_task_id_tasks_id_fk" TO "task_queue_items_task_id_tasks_id_fk";--> statement-breakpoint
ALTER TABLE "task_queue_items" ALTER COLUMN "period_start" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "task_queue_items" ADD COLUMN "queue_id" text;--> statement-breakpoint
INSERT INTO "task_queues" ("id", "key", "name", "period_unit", "position") VALUES
	(gen_random_uuid(), 'day', 'today', 'day', 0),
	(gen_random_uuid(), 'week', 'this week', 'week', 1);--> statement-breakpoint
UPDATE "task_queue_items" SET "queue_id" = (SELECT "id" FROM "task_queues" WHERE "key" = 'day');--> statement-breakpoint
ALTER TABLE "task_queue_items" ALTER COLUMN "queue_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "task_queue_items" ADD CONSTRAINT "task_queue_items_queue_id_task_queues_id_fk" FOREIGN KEY ("queue_id") REFERENCES "public"."task_queues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_queue_items" ADD CONSTRAINT "task_queue_items_queue_period_task_unique" UNIQUE NULLS NOT DISTINCT("queue_id","period_start","task_id");--> statement-breakpoint
CREATE INDEX "idx_task_queue_items_queue_period_sort" ON "task_queue_items" USING btree ("queue_id","period_start","sort_order");--> statement-breakpoint
CREATE INDEX "idx_task_queue_items_task_id" ON "task_queue_items" USING btree ("task_id");
