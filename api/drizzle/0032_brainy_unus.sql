CREATE TABLE "task_relations" (
	"source_task_id" text NOT NULL,
	"target_task_id" text NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_relations_source_task_id_target_task_id_type_pk" PRIMARY KEY("source_task_id","target_task_id","type"),
	CONSTRAINT "task_relations_no_self_relation" CHECK ("task_relations"."source_task_id" != "task_relations"."target_task_id")
);
--> statement-breakpoint
ALTER TABLE "task_relations" ADD CONSTRAINT "task_relations_source_task_id_tasks_id_fk" FOREIGN KEY ("source_task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_relations" ADD CONSTRAINT "task_relations_target_task_id_tasks_id_fk" FOREIGN KEY ("target_task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_task_relations_target_task_id_type" ON "task_relations" USING btree ("target_task_id","type");
