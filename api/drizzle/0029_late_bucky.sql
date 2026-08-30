ALTER TABLE "task_github_links" DROP CONSTRAINT "task_github_links_task_id_unique";--> statement-breakpoint
ALTER TABLE "task_github_links" ADD COLUMN "seq" bigint NOT NULL GENERATED ALWAYS AS IDENTITY (sequence name "task_github_links_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
CREATE INDEX "idx_task_github_links_task_id_created_at" ON "task_github_links" USING btree ("task_id","created_at");
