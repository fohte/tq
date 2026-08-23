CREATE TABLE "task_agent_sessions" (
	"task_id" text NOT NULL,
	"agent_session_id" text NOT NULL,
	CONSTRAINT "task_agent_sessions_task_id_agent_session_id_pk" PRIMARY KEY("task_id","agent_session_id")
);
--> statement-breakpoint
ALTER TABLE "task_agent_sessions" ADD CONSTRAINT "task_agent_sessions_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_agent_sessions" ADD CONSTRAINT "task_agent_sessions_agent_session_id_agent_sessions_id_fk" FOREIGN KEY ("agent_session_id") REFERENCES "public"."agent_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_task_agent_sessions_task_id" ON "task_agent_sessions" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "idx_task_agent_sessions_agent_session_id" ON "task_agent_sessions" USING btree ("agent_session_id");
