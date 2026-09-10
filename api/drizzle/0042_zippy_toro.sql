ALTER TABLE "tasks" ADD COLUMN "template_id" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "occurrence_date" date;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_template_id_recurring_task_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."recurring_task_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_tasks_template_id" ON "tasks" USING btree ("template_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_template_id_occurrence_date_unique" ON "tasks" USING btree ("template_id","occurrence_date") WHERE "tasks"."template_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_template_occurrence_paired_check" CHECK (("tasks"."template_id" IS NULL) = ("tasks"."occurrence_date" IS NULL));--> statement-breakpoint
-- Backfill: link each pre-existing recurring task back to the template
-- 0040_add_recurring_task_templates.sql cloned from it, by matching
-- field-for-field against the cloned template and its cloned rule.
WITH candidates AS (
  SELECT
    t."id" AS task_id,
    rtt."id" AS template_id,
    t."due_date" AS occurrence_date
  FROM "tasks" t
  JOIN "recurrence_rules" old_rr ON old_rr."id" = t."recurrence_rule_id"
  CROSS JOIN "recurring_task_templates" rtt
  JOIN "recurrence_rules" new_rr ON new_rr."id" = rtt."recurrence_rule_id"
  WHERE
    -- 0040 never set anchor_date/last_generated_date from due_date when
    -- due_date was null, so there is no reliable field to match on.
    t."due_date" IS NOT NULL
    AND t."recurrence_rule_id" IS NOT NULL
    AND old_rr."type" = new_rr."type"
    AND old_rr."interval" = new_rr."interval"
    AND old_rr."days_of_week" IS NOT DISTINCT FROM new_rr."days_of_week"
    AND old_rr."day_of_month" IS NOT DISTINCT FROM new_rr."day_of_month"
    AND t."title" = rtt."title"
    AND t."description" IS NOT DISTINCT FROM rtt."description"
    AND t."estimated_minutes" IS NOT DISTINCT FROM rtt."estimated_minutes"
    AND t."project_id" IS NOT DISTINCT FROM rtt."project_id"
    AND t."parent_id" IS NOT DISTINCT FROM rtt."parent_id"
    AND t."context" = rtt."context"
    AND t."due_date" = rtt."anchor_date"
),
-- Count matches on both sides of the pair so a task matching more than one
-- template (task_match_counts), or a template matching more than one task at
-- the same occurrence_date (pair_match_counts), is skipped instead of linked
-- arbitrarily -- the latter would otherwise violate the unique index just
-- added above.
task_match_counts AS (
  SELECT task_id, COUNT(*) AS match_count
  FROM candidates
  GROUP BY task_id
),
pair_match_counts AS (
  SELECT template_id, occurrence_date, COUNT(*) AS match_count
  FROM candidates
  GROUP BY template_id, occurrence_date
)
UPDATE "tasks"
SET "template_id" = candidates.template_id, "occurrence_date" = candidates.occurrence_date
FROM candidates
JOIN task_match_counts ON task_match_counts.task_id = candidates.task_id
JOIN pair_match_counts
  ON pair_match_counts.template_id = candidates.template_id
  AND pair_match_counts.occurrence_date = candidates.occurrence_date
WHERE "tasks"."id" = candidates.task_id
  AND task_match_counts.match_count = 1
  AND pair_match_counts.match_count = 1;--> statement-breakpoint
-- 0040 cloned one template per historical task that ever had a
-- recurrence_rule_id, instead of one per completion chain (every generated
-- instance carries its chain's original, shared recurrence_rule_id forward --
-- see the removed `buildNextTaskData`). A chain completed N times therefore
-- produced N separately-`enabled` templates, each anchored at its own
-- historical due date, and the scheduler would catch up every one of them.
-- Keep enabled only the template linked (via the backfill above) to each
-- chain's most recent task; disable the rest.
WITH ranked AS (
  SELECT
    t."template_id",
    row_number() OVER (
      PARTITION BY t."recurrence_rule_id"
      ORDER BY t."due_date" DESC
    ) AS rn
  FROM "tasks" t
  WHERE t."template_id" IS NOT NULL
)
UPDATE "recurring_task_templates"
SET "enabled" = false, "updated_at" = now()
FROM ranked
WHERE "recurring_task_templates"."id" = ranked."template_id"
  AND ranked.rn > 1;
