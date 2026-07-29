ALTER TABLE "task_github_links" ADD COLUMN "body" text;--> statement-breakpoint
UPDATE "task_github_links" AS l SET "body" = t."description"
FROM "tasks" AS t
WHERE t."id" = l."task_id";
