ALTER TABLE "tasks" ADD COLUMN "description_template_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_description_template_id_task_description_templates_id_fk" FOREIGN KEY ("description_template_id") REFERENCES "public"."task_description_templates"("id") ON DELETE set null ON UPDATE no action;
