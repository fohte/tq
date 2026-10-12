ALTER TABLE "edits" DROP CONSTRAINT "edits_author_agent_required_for_llm";--> statement-breakpoint
ALTER TABLE "edits" DROP CONSTRAINT "edits_author_kind_check";--> statement-breakpoint
ALTER TABLE "task_events" DROP CONSTRAINT "task_events_author_agent_required_for_llm";--> statement-breakpoint
ALTER TABLE "task_events" DROP CONSTRAINT "task_events_author_kind_check";--> statement-breakpoint
ALTER TABLE "edits" ADD CONSTRAINT "edits_author_agent_required_for_llm_or_service" CHECK (("edits"."author_kind" IN ('llm', 'service')) = ("edits"."author_agent" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "edits" ADD CONSTRAINT "edits_author_kind_check" CHECK ("edits"."author_kind" IN ('human', 'llm', 'service', 'system'));--> statement-breakpoint
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_author_agent_required_for_llm_or_service" CHECK (("task_events"."author_kind" IN ('llm', 'service')) = ("task_events"."author_agent" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_author_kind_check" CHECK ("task_events"."author_kind" IN ('human', 'llm', 'service', 'system'));
