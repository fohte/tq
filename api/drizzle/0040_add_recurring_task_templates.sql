CREATE TABLE "recurring_task_template_labels" (
	"template_id" text NOT NULL,
	"label_id" text NOT NULL,
	CONSTRAINT "recurring_task_template_labels_template_id_label_id_pk" PRIMARY KEY("template_id","label_id")
);
--> statement-breakpoint
CREATE TABLE "recurring_task_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"estimated_minutes" integer,
	"project_id" text,
	"parent_id" text,
	"context" text DEFAULT 'personal' NOT NULL,
	"recurrence_rule_id" text NOT NULL,
	"start_offset_days" integer,
	"anchor_date" date NOT NULL,
	"last_generated_date" date,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recurring_task_template_labels" ADD CONSTRAINT "recurring_task_template_labels_template_id_recurring_task_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."recurring_task_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_task_template_labels" ADD CONSTRAINT "recurring_task_template_labels_label_id_labels_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."labels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_task_templates" ADD CONSTRAINT "recurring_task_templates_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_task_templates" ADD CONSTRAINT "recurring_task_templates_parent_id_tasks_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_task_templates" ADD CONSTRAINT "recurring_task_templates_recurrence_rule_id_recurrence_rules_id_fk" FOREIGN KEY ("recurrence_rule_id") REFERENCES "public"."recurrence_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_recurring_task_template_labels_template_id" ON "recurring_task_template_labels" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "idx_recurring_task_template_labels_label_id" ON "recurring_task_template_labels" USING btree ("label_id");--> statement-breakpoint
CREATE INDEX "idx_recurring_task_templates_project_id" ON "recurring_task_templates" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_recurring_task_templates_parent_id" ON "recurring_task_templates" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_recurring_task_templates_context" ON "recurring_task_templates" USING btree ("context");--> statement-breakpoint
CREATE INDEX "idx_recurring_task_templates_enabled" ON "recurring_task_templates" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "idx_recurring_task_templates_recurrence_rule_id" ON "recurring_task_templates" USING btree ("recurrence_rule_id");--> statement-breakpoint
-- Backfills a template for every task that already has a recurrence rule,
-- so each becomes the first instance of its own template. Each template
-- gets its own copy of the rule row rather than sharing the task's, since
-- `recurring_task_templates.recurrence_rule_id` is owned exclusively by the
-- template (see the column comment in the schema) -- sharing it would make
-- the task-side rule-cleanup checks in tasks/crud.ts and tasks/actions.ts
-- blind to the template's reference.
-- The three inserts are chained through explicit joins (rather than acting
-- as independent CTEs) because sibling data-modifying CTEs in Postgres have
-- no guaranteed execution order otherwise, and the FK chain here requires
-- the rule to exist before the template, and the template before its labels.
WITH source AS (
  SELECT
    t."id" AS task_id,
    gen_random_uuid()::text AS template_id,
    gen_random_uuid()::text AS new_rule_id,
    t."title",
    t."description",
    t."estimated_minutes",
    t."project_id",
    t."parent_id",
    t."context",
    t."start_date",
    t."due_date",
    rr."type",
    rr."interval",
    rr."days_of_week",
    rr."day_of_month"
  FROM "tasks" t
  JOIN "recurrence_rules" rr ON rr."id" = t."recurrence_rule_id"
  WHERE t."recurrence_rule_id" IS NOT NULL
),
ins_rules AS (
  INSERT INTO "recurrence_rules" ("id", "type", "interval", "days_of_week", "day_of_month")
  SELECT "new_rule_id", "type", "interval", "days_of_week", "day_of_month" FROM source
  RETURNING "id"
),
ins_templates AS (
  INSERT INTO "recurring_task_templates" (
    "id", "title", "description", "estimated_minutes", "project_id", "parent_id",
    "context", "recurrence_rule_id", "start_offset_days", "anchor_date",
    "last_generated_date", "enabled"
  )
  SELECT
    source."template_id",
    source."title",
    source."description",
    source."estimated_minutes",
    source."project_id",
    source."parent_id",
    source."context",
    ins_rules."id",
    CASE
      WHEN source."start_date" IS NOT NULL AND source."due_date" IS NOT NULL
        THEN source."due_date" - source."start_date"
    END,
    COALESCE(source."due_date", CURRENT_DATE),
    source."due_date",
    true
  FROM source
  JOIN ins_rules ON ins_rules."id" = source."new_rule_id"
  RETURNING "id"
)
INSERT INTO "recurring_task_template_labels" ("template_id", "label_id")
SELECT source."template_id", tl."label_id"
FROM source
JOIN ins_templates ON ins_templates."id" = source."template_id"
JOIN "task_labels" tl ON tl."task_id" = source."task_id";
