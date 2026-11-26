CREATE TABLE "task_field_values" (
	"task_id" text NOT NULL,
	"project_id" text NOT NULL,
	"field_id" uuid NOT NULL,
	"option_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_field_values_task_id_field_id_pk" PRIMARY KEY("task_id","field_id")
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "uq_tasks_id_project_id" UNIQUE("id","project_id");
--> statement-breakpoint
ALTER TABLE "task_field_values" ADD CONSTRAINT "fk_task_field_values_task_project" FOREIGN KEY ("task_id","project_id") REFERENCES "public"."tasks"("id","project_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_field_values" ADD CONSTRAINT "fk_task_field_values_field_project" FOREIGN KEY ("field_id","project_id") REFERENCES "public"."project_fields"("id","project_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_field_values" ADD CONSTRAINT "fk_task_field_values_option_field" FOREIGN KEY ("option_id","field_id") REFERENCES "public"."project_field_options"("id","field_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
