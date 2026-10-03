# public.recurrence_rules

## Description

Recurrence definitions referenced by tasks, schedules, and recurring task templates.

## Columns

| Name         | Type                     | Default | Nullable | Children                                                                                                                                      | Parents | Comment                                                                         |
| ------------ | ------------------------ | ------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------- |
| id           | text                     |         | false    | [public.schedules](public.schedules.md) [public.tasks](public.tasks.md) [public.recurring_task_templates](public.recurring_task_templates.md) |         |                                                                                 |
| type         | text                     |         | false    |                                                                                                                                               |         | Recurrence unit or pattern: daily, weekly, monthly, or custom.                  |
| interval     | integer                  | 1       | false    |                                                                                                                                               |         | Number of recurrence units between occurrences.                                 |
| days_of_week | integer[]                |         | true     |                                                                                                                                               |         | Days selected for weekly recurrence, using 0 for Sunday through 6 for Saturday. |
| day_of_month | integer                  |         | true     |                                                                                                                                               |         | Calendar day selected for monthly recurrence, from 1 through 31.                |
| created_at   | timestamp with time zone | now()   | false    |                                                                                                                                               |         |                                                                                 |
| updated_at   | timestamp with time zone | now()   | false    |                                                                                                                                               |         |                                                                                 |

## Constraints

| Name                                 | Type        | Definition          |
| ------------------------------------ | ----------- | ------------------- |
| recurrence_rules_created_at_not_null | n           | NOT NULL created_at |
| recurrence_rules_id_not_null         | n           | NOT NULL id         |
| recurrence_rules_interval_not_null   | n           | NOT NULL "interval" |
| recurrence_rules_type_not_null       | n           | NOT NULL type       |
| recurrence_rules_updated_at_not_null | n           | NOT NULL updated_at |
| recurrence_rules_pkey                | PRIMARY KEY | PRIMARY KEY (id)    |

## Indexes

| Name                  | Definition                                                                            |
| --------------------- | ------------------------------------------------------------------------------------- |
| recurrence_rules_pkey | CREATE UNIQUE INDEX recurrence_rules_pkey ON public.recurrence_rules USING btree (id) |

## Relations

```mermaid
erDiagram

"public.schedules" }o--o| "public.recurrence_rules" : "FOREIGN KEY (recurrence_rule_id) REFERENCES recurrence_rules(id) ON DELETE SET NULL"
"public.tasks" }o--o| "public.recurrence_rules" : "FOREIGN KEY (recurrence_rule_id) REFERENCES recurrence_rules(id) ON DELETE SET NULL"
"public.recurring_task_templates" |o--|| "public.recurrence_rules" : "FOREIGN KEY (recurrence_rule_id) REFERENCES recurrence_rules(id)"

"public.recurrence_rules" {
  text id
  text type
  integer interval
  integer__ days_of_week
  integer day_of_month
  timestamp_with_time_zone created_at
  timestamp_with_time_zone updated_at
}
"public.schedules" {
  text id
  text title
  text start_time
  text end_time
  text recurrence_rule_id FK
  text context
  text color
  timestamp_with_time_zone created_at
  timestamp_with_time_zone updated_at
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
  text template_id FK
  date occurrence_date
}
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
```

---

> Generated by [tbls](https://github.com/k1LoW/tbls)
