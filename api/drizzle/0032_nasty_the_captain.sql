CREATE TABLE "task_relations" (
	"source_task_id" text NOT NULL,
	"target_task_id" text NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_relations_source_task_id_target_task_id_type_pk" PRIMARY KEY("source_task_id","target_task_id","type"),
	CONSTRAINT "task_relations_no_self_relation" CHECK ("task_relations"."source_task_id" != "task_relations"."target_task_id")
);
--> statement-breakpoint
ALTER TABLE "task_events" DROP CONSTRAINT "task_events_payload_check";--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "status_reason" text;--> statement-breakpoint
ALTER TABLE "task_events" ADD COLUMN "to_status_reason" text;--> statement-breakpoint
ALTER TABLE "task_relations" ADD CONSTRAINT "task_relations_source_task_id_tasks_id_fk" FOREIGN KEY ("source_task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_relations" ADD CONSTRAINT "task_relations_target_task_id_tasks_id_fk" FOREIGN KEY ("target_task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_task_relations_target_task_id_type" ON "task_relations" USING btree ("target_task_id","type");--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_status_reason_check" CHECK ("tasks"."status" = 'completed' OR "tasks"."status_reason" IS NULL);--> statement-breakpoint
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_payload_check" CHECK (("task_events"."type" = 'status_changed'
          AND "task_events"."from_status" IS NOT NULL AND "task_events"."to_status" IS NOT NULL
          AND ("task_events"."to_status" = 'completed' OR "task_events"."to_status_reason" IS NULL)
          AND "task_events"."github_owner" IS NULL AND "task_events"."github_repo" IS NULL
          AND "task_events"."github_number" IS NULL AND "task_events"."github_kind" IS NULL)
        OR ("task_events"."type" IN ('github_linked', 'github_unlinked')
          AND "task_events"."from_status" IS NULL AND "task_events"."to_status" IS NULL
          AND "task_events"."to_status_reason" IS NULL
          AND "task_events"."github_owner" IS NOT NULL AND "task_events"."github_repo" IS NOT NULL
          AND "task_events"."github_number" IS NOT NULL AND "task_events"."github_kind" IS NOT NULL));
