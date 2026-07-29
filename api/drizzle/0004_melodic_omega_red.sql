ALTER TABLE "tasks" ADD COLUMN "number" integer;--> statement-breakpoint
UPDATE "tasks" AS t SET "number" = ordered.rn
FROM (SELECT "id", row_number() OVER (ORDER BY "created_at", "id") AS rn FROM "tasks") AS ordered
WHERE ordered."id" = t."id";--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "number" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "number" ADD GENERATED ALWAYS AS IDENTITY (sequence name "tasks_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
SELECT setval(
  'tasks_number_seq',
  GREATEST(COALESCE((SELECT MAX("number") FROM "tasks"), 1), 1),
  EXISTS (SELECT 1 FROM "tasks")
);--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_number_unique" UNIQUE("number");
