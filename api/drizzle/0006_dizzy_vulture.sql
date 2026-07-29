CREATE TABLE "edits" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "edits_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"task_id" text NOT NULL,
	"page_id" text,
	"comment_id" text,
	"action" text NOT NULL,
	"field" text,
	"author_kind" text NOT NULL,
	"author_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "edits_action_check" CHECK ("edits"."action" IN ('create', 'update')),
	CONSTRAINT "edits_action_field_check" CHECK (("edits"."action" = 'create' AND "edits"."field" IS NULL) OR ("edits"."action" = 'update' AND "edits"."field" IS NOT NULL)),
	CONSTRAINT "edits_field_target_check" CHECK ("edits"."field" IS NULL
        OR ("edits"."page_id" IS NULL AND "edits"."comment_id" IS NULL AND "edits"."field" IN ('title', 'description'))
        OR ("edits"."page_id" IS NOT NULL AND "edits"."field" IN ('title', 'content'))
        OR ("edits"."comment_id" IS NOT NULL AND "edits"."field" = 'content')),
	CONSTRAINT "edits_target_exclusive_check" CHECK (NOT ("edits"."page_id" IS NOT NULL AND "edits"."comment_id" IS NOT NULL)),
	CONSTRAINT "edits_author_kind_check" CHECK ("edits"."author_kind" IN ('human', 'llm', 'system')),
	CONSTRAINT "edits_author_agent_required_for_llm" CHECK (("edits"."author_kind" = 'llm') = ("edits"."author_agent" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "edits" ADD CONSTRAINT "edits_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edits" ADD CONSTRAINT "edits_page_id_task_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."task_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edits" ADD CONSTRAINT "edits_comment_id_task_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."task_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_edits_task_id_created_at" ON "edits" USING btree ("task_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_edits_page_id" ON "edits" USING btree ("page_id") WHERE "edits"."page_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_edits_comment_id" ON "edits" USING btree ("comment_id") WHERE "edits"."comment_id" IS NOT NULL;
