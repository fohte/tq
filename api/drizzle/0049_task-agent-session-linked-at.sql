ALTER TABLE "task_agent_sessions" ADD COLUMN "linked_at" timestamp with time zone DEFAULT now() NOT NULL;
