CREATE INDEX "idx_task_github_links_task_id_created_at" ON "task_github_links" USING btree ("task_id","created_at");
