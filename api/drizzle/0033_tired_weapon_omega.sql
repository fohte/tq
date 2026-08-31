ALTER TABLE "task_events" DROP CONSTRAINT "task_events_payload_check";--> statement-breakpoint
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
