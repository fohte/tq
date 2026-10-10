# public.task_queue_items

## Description

Tasks placed in a queue, optionally for a specific period.

## Columns

| Name         | Type                     | Default | Nullable | Children | Parents                                     | Comment                                                                                                                       |
| ------------ | ------------------------ | ------- | -------- | -------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| id           | text                     |         | false    |          |                                             |                                                                                                                               |
| task_id      | text                     |         | false    |          | [public.tasks](public.tasks.md)             | Task placed in the queue.                                                                                                     |
| period_start | date                     |         | true     |          |                                             | Period start date: the date for a daily queue, Monday for a weekly queue, or the first of the month; null for a static queue. |
| sort_order   | integer                  | 0       | false    |          |                                             | Position of the task within the queue period.                                                                                 |
| created_at   | timestamp with time zone | now()   | false    |          |                                             |                                                                                                                               |
| updated_at   | timestamp with time zone | now()   | false    |          |                                             |                                                                                                                               |
| queue_id     | text                     |         | false    |          | [public.task_queues](public.task_queues.md) | Queue containing the task.                                                                                                    |

## Constraints

| Name                                        | Type        | Definition                                                          |
| ------------------------------------------- | ----------- | ------------------------------------------------------------------- |
| task_queue_items_queue_id_not_null          | n           | NOT NULL queue_id                                                   |
| today_tasks_created_at_not_null             | n           | NOT NULL created_at                                                 |
| today_tasks_id_not_null                     | n           | NOT NULL id                                                         |
| today_tasks_sort_order_not_null             | n           | NOT NULL sort_order                                                 |
| today_tasks_task_id_not_null                | n           | NOT NULL task_id                                                    |
| today_tasks_updated_at_not_null             | n           | NOT NULL updated_at                                                 |
| task_queue_items_task_id_tasks_id_fk        | FOREIGN KEY | FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE        |
| task_queue_items_pkey                       | PRIMARY KEY | PRIMARY KEY (id)                                                    |
| task_queue_items_queue_id_task_queues_id_fk | FOREIGN KEY | FOREIGN KEY (queue_id) REFERENCES task_queues(id) ON DELETE CASCADE |
| task_queue_items_queue_period_task_unique   | UNIQUE      | UNIQUE NULLS NOT DISTINCT (queue_id, period_start, task_id)         |

## Indexes

| Name                                      | Definition                                                                                                                                                |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| task_queue_items_pkey                     | CREATE UNIQUE INDEX task_queue_items_pkey ON public.task_queue_items USING btree (id)                                                                     |
| task_queue_items_queue_period_task_unique | CREATE UNIQUE INDEX task_queue_items_queue_period_task_unique ON public.task_queue_items USING btree (queue_id, period_start, task_id) NULLS NOT DISTINCT |
| idx_task_queue_items_queue_period_sort    | CREATE INDEX idx_task_queue_items_queue_period_sort ON public.task_queue_items USING btree (queue_id, period_start, sort_order)                           |
| idx_task_queue_items_task_id              | CREATE INDEX idx_task_queue_items_task_id ON public.task_queue_items USING btree (task_id)                                                                |

## Relations

```mermaid
erDiagram

"public.task_queue_items" }o--|| "public.tasks" : "FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE"
"public.task_queue_items" }o--|| "public.task_queues" : "FOREIGN KEY (queue_id) REFERENCES task_queues(id) ON DELETE CASCADE"

"public.task_queue_items" {
  text id
  text task_id FK
  date period_start
  integer sort_order
  timestamp_with_time_zone created_at
  timestamp_with_time_zone updated_at
  text queue_id FK
}
"public.tasks" {
  text id
  text title
  text description
  text status
  date start_date
  date due_date
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
  uuid description_template_id FK
}
"public.task_queues" {
  text id
  text key
  text name
  text period_unit
  integer position
  timestamp_with_time_zone created_at
  timestamp_with_time_zone updated_at
}
```

---

> Generated by [tbls](https://github.com/k1LoW/tbls)
