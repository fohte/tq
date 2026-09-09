# public.recurring_task_templates

## Columns

| Name                | Type                     | Default          | Nullable | Children                                                                          | Parents                                               | Comment |
| ------------------- | ------------------------ | ---------------- | -------- | --------------------------------------------------------------------------------- | ----------------------------------------------------- | ------- |
| id                  | text                     |                  | false    | [public.recurring_task_template_labels](public.recurring_task_template_labels.md) |                                                       |         |
| title               | text                     |                  | false    |                                                                                   |                                                       |         |
| description         | text                     |                  | true     |                                                                                   |                                                       |         |
| estimated_minutes   | integer                  |                  | true     |                                                                                   |                                                       |         |
| project_id          | text                     |                  | true     |                                                                                   | [public.projects](public.projects.md)                 |         |
| parent_id           | text                     |                  | true     |                                                                                   | [public.tasks](public.tasks.md)                       |         |
| context             | text                     | 'personal'::text | false    |                                                                                   |                                                       |         |
| recurrence_rule_id  | text                     |                  | false    |                                                                                   | [public.recurrence_rules](public.recurrence_rules.md) |         |
| start_offset_days   | integer                  |                  | true     |                                                                                   |                                                       |         |
| anchor_date         | date                     |                  | false    |                                                                                   |                                                       |         |
| last_generated_date | date                     |                  | true     |                                                                                   |                                                       |         |
| enabled             | boolean                  | true             | false    |                                                                                   |                                                       |         |
| created_at          | timestamp with time zone | now()            | false    |                                                                                   |                                                       |         |
| updated_at          | timestamp with time zone | now()            | false    |                                                                                   |                                                       |         |

## Constraints

| Name                                                            | Type        | Definition                                                          |
| --------------------------------------------------------------- | ----------- | ------------------------------------------------------------------- |
| recurring_task_templates_project_id_projects_id_fk              | FOREIGN KEY | FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL |
| recurring_task_templates_recurrence_rule_id_recurrence_rules_id | FOREIGN KEY | FOREIGN KEY (recurrence_rule_id) REFERENCES recurrence_rules(id)    |
| recurring_task_templates_parent_id_tasks_id_fk                  | FOREIGN KEY | FOREIGN KEY (parent_id) REFERENCES tasks(id) ON DELETE SET NULL     |
| recurring_task_templates_pkey                                   | PRIMARY KEY | PRIMARY KEY (id)                                                    |

## Indexes

| Name                                            | Definition                                                                                                                       |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| recurring_task_templates_pkey                   | CREATE UNIQUE INDEX recurring_task_templates_pkey ON public.recurring_task_templates USING btree (id)                            |
| idx_recurring_task_templates_project_id         | CREATE INDEX idx_recurring_task_templates_project_id ON public.recurring_task_templates USING btree (project_id)                 |
| idx_recurring_task_templates_parent_id          | CREATE INDEX idx_recurring_task_templates_parent_id ON public.recurring_task_templates USING btree (parent_id)                   |
| idx_recurring_task_templates_context            | CREATE INDEX idx_recurring_task_templates_context ON public.recurring_task_templates USING btree (context)                       |
| idx_recurring_task_templates_enabled            | CREATE INDEX idx_recurring_task_templates_enabled ON public.recurring_task_templates USING btree (enabled)                       |
| idx_recurring_task_templates_recurrence_rule_id | CREATE INDEX idx_recurring_task_templates_recurrence_rule_id ON public.recurring_task_templates USING btree (recurrence_rule_id) |

## Relations

```mermaid
erDiagram

"public.recurring_task_template_labels" }o--|| "public.recurring_task_templates" : "FOREIGN KEY (template_id) REFERENCES recurring_task_templates(id) ON DELETE CASCADE"
"public.recurring_task_templates" }o--o| "public.projects" : "FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL"
"public.recurring_task_templates" }o--o| "public.tasks" : "FOREIGN KEY (parent_id) REFERENCES tasks(id) ON DELETE SET NULL"
"public.recurring_task_templates" }o--|| "public.recurrence_rules" : "FOREIGN KEY (recurrence_rule_id) REFERENCES recurrence_rules(id)"

"public.recurring_task_templates" {
  text id
  text title
  text description
  integer estimated_minutes
  text project_id FK
  text parent_id FK
  text context
  text recurrence_rule_id FK
  integer start_offset_days
  date anchor_date
  date last_generated_date
  boolean enabled
  timestamp_with_time_zone created_at
  timestamp_with_time_zone updated_at
}
"public.recurring_task_template_labels" {
  text template_id FK
  text label_id FK
}
"public.projects" {
  text id
  text title
  text description
  text status
  date start_date
  date target_date
  text color
  integer sort_order
  timestamp_with_time_zone created_at
  timestamp_with_time_zone updated_at
  text context
}
"public.tasks" {
  text id
  text title
  text description
  text status
  date start_date
  date due_date
  integer estimated_minutes
  text parent_id FK
  text project_id FK
  text recurrence_rule_id FK
  text context
  timestamp_with_time_zone created_at
  timestamp_with_time_zone updated_at
  integer number
  text commitment
  text status_reason
  timestamp_with_time_zone remind_at
}
"public.recurrence_rules" {
  text id
  text type
  integer interval
  integer__ days_of_week
  integer day_of_month
  timestamp_with_time_zone created_at
  timestamp_with_time_zone updated_at
}
```

---

> Generated by [tbls](https://github.com/k1LoW/tbls)
