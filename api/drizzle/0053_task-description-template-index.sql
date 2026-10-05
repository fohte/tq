CREATE INDEX "idx_tasks_description_template_id" ON "tasks" USING btree ("description_template_id") WHERE "tasks"."description_template_id" IS NOT NULL;
