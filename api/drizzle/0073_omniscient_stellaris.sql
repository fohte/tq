CREATE INDEX "idx_task_field_values_project_id" ON "task_field_values" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_task_field_values_field_project_task" ON "task_field_values" USING btree ("field_id","project_id","task_id");--> statement-breakpoint
CREATE INDEX "idx_task_field_values_option_field_task" ON "task_field_values" USING btree ("option_id","field_id","task_id");
