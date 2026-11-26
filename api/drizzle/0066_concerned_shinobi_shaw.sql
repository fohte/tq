ALTER TABLE "tasks" ADD COLUMN "priority" integer;--> statement-breakpoint
UPDATE "tasks" SET "priority" = CASE "commitment"
  WHEN 'inbox' THEN NULL
  WHEN 'active' THEN 0
  WHEN 'someday' THEN -1
  ELSE NULL
END;--> statement-breakpoint
UPDATE "saved_views"
SET "query" = regexp_replace(
  regexp_replace(
    regexp_replace(
      "query",
      '(^|[[:blank:]]|["''])commitment:inbox(?=$|[[:blank:]]|["''])',
      '\1priority:none',
      'g'
    ),
    '(^|[[:blank:]]|["''])commitment:active(?=$|[[:blank:]]|["''])',
    '\1priority:0',
    'g'
  ),
  '(^|[[:blank:]]|["''])commitment:someday(?=$|[[:blank:]]|["''])',
  '\1priority:-1',
  'g'
);--> statement-breakpoint
CREATE INDEX "idx_tasks_priority" ON "tasks" USING btree ("priority");--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_priority_check" CHECK ("tasks"."priority" IS NULL OR "tasks"."priority" BETWEEN -1 AND 2);
