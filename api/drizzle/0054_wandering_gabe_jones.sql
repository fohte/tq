CREATE TABLE "task_checklist_items" (
	"id" text PRIMARY KEY NOT NULL,
	"checklist_id" text NOT NULL,
	"parent_item_id" text,
	"content" text NOT NULL,
	"note" text,
	"checked_at" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"github_link_id" text,
	"subtask_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_task_checklist_items_id_checklist_id" UNIQUE("id","checklist_id"),
	CONSTRAINT "task_checklist_items_link_exclusive_check" CHECK (NOT ("task_checklist_items"."github_link_id" IS NOT NULL AND "task_checklist_items"."subtask_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "task_checklists" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"name" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "task_checklist_items" ADD CONSTRAINT "task_checklist_items_checklist_id_task_checklists_id_fk" FOREIGN KEY ("checklist_id") REFERENCES "public"."task_checklists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_checklist_items" ADD CONSTRAINT "task_checklist_items_github_link_id_task_github_links_id_fk" FOREIGN KEY ("github_link_id") REFERENCES "public"."task_github_links"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_checklist_items" ADD CONSTRAINT "task_checklist_items_subtask_id_tasks_id_fk" FOREIGN KEY ("subtask_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_checklist_items" ADD CONSTRAINT "fk_task_checklist_items_parent_same_checklist" FOREIGN KEY ("parent_item_id","checklist_id") REFERENCES "public"."task_checklist_items"("id","checklist_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_checklists" ADD CONSTRAINT "task_checklists_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_task_checklist_items_checklist_id_parent_sort" ON "task_checklist_items" USING btree ("checklist_id","parent_item_id","sort_order");--> statement-breakpoint
CREATE INDEX "idx_task_checklist_items_github_link_id" ON "task_checklist_items" USING btree ("github_link_id") WHERE "task_checklist_items"."github_link_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_task_checklist_items_subtask_id" ON "task_checklist_items" USING btree ("subtask_id") WHERE "task_checklist_items"."subtask_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_task_checklists_task_id_sort_order" ON "task_checklists" USING btree ("task_id","sort_order");
