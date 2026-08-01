CREATE TABLE "task_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "task_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"task_id" text NOT NULL,
	"type" text NOT NULL,
	"from_status" text,
	"to_status" text,
	"github_owner" text,
	"github_repo" text,
	"github_number" integer,
	"github_kind" text,
	"author_kind" text NOT NULL,
	"author_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_events_type_check" CHECK ("task_events"."type" IN ('status_changed', 'github_linked', 'github_unlinked')),
	CONSTRAINT "task_events_payload_check" CHECK (("task_events"."type" = 'status_changed'
          AND "task_events"."from_status" IS NOT NULL AND "task_events"."to_status" IS NOT NULL
          AND "task_events"."github_owner" IS NULL AND "task_events"."github_repo" IS NULL
          AND "task_events"."github_number" IS NULL AND "task_events"."github_kind" IS NULL)
        OR ("task_events"."type" IN ('github_linked', 'github_unlinked')
          AND "task_events"."from_status" IS NULL AND "task_events"."to_status" IS NULL
          AND "task_events"."github_owner" IS NOT NULL AND "task_events"."github_repo" IS NOT NULL
          AND "task_events"."github_number" IS NOT NULL AND "task_events"."github_kind" IS NOT NULL)),
	CONSTRAINT "task_events_author_kind_check" CHECK ("task_events"."author_kind" IN ('human', 'llm', 'system')),
	CONSTRAINT "task_events_author_agent_required_for_llm" CHECK (("task_events"."author_kind" = 'llm') = ("task_events"."author_agent" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_task_events_task_id_created_at" ON "task_events" USING btree ("task_id","created_at");
