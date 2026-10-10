# public.task_waits

## Description

Response waits attached to tasks with optional GitHub blocker links.

## Columns

| Name            | Type                     | Default           | Nullable | Children | Parents                                                 | Comment                                                                                        |
| --------------- | ------------------------ | ----------------- | -------- | -------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| id              | uuid                     | gen_random_uuid() | false    |          |                                                         |                                                                                                |
| task_id         | text                     |                   | false    |          | [public.tasks](public.tasks.md)                         | Task waiting for a response.                                                                   |
| body            | text                     |                   | true     |          |                                                         | Optional Markdown describing the response or action the task is waiting for.                   |
| follow_up_date  | date                     |                   | false    |          |                                                         | Date to follow up when no response has arrived.                                                |
| resolved_at     | timestamp with time zone |                   | true     |          |                                                         | Time when the response wait was resolved; null while it blocks the task.                       |
| acknowledged_at | timestamp with time zone |                   | true     |          |                                                         | Time when the resolution was acknowledged by the user.                                         |
| created_at      | timestamp with time zone | now()             | false    |          |                                                         |                                                                                                |
| github_link_id  | text                     |                   | true     |          | [public.task_github_links](public.task_github_links.md) | GitHub blocker associated with this response wait; deleting the blocker also deletes the wait. |

## Constraints

| Name                                              | Type        | Definition                                                                      |
| ------------------------------------------------- | ----------- | ------------------------------------------------------------------------------- |
| task_waits_acknowledged_requires_resolved         | CHECK       | CHECK (((acknowledged_at IS NULL) OR (resolved_at IS NOT NULL)))                |
| task_waits_body_or_github_link_check              | CHECK       | CHECK (((body IS NOT NULL) OR (github_link_id IS NOT NULL)))                    |
| task_waits_created_at_not_null                    | n           | NOT NULL created_at                                                             |
| task_waits_follow_up_date_not_null                | n           | NOT NULL follow_up_date                                                         |
| task_waits_id_not_null                            | n           | NOT NULL id                                                                     |
| task_waits_task_id_not_null                       | n           | NOT NULL task_id                                                                |
| task_waits_task_id_tasks_id_fk                    | FOREIGN KEY | FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE                    |
| task_waits_github_link_id_task_github_links_id_fk | FOREIGN KEY | FOREIGN KEY (github_link_id) REFERENCES task_github_links(id) ON DELETE CASCADE |
| task_waits_pkey                                   | PRIMARY KEY | PRIMARY KEY (id)                                                                |

## Indexes

| Name                         | Definition                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| task_waits_pkey              | CREATE UNIQUE INDEX task_waits_pkey ON public.task_waits USING btree (id)                                                      |
| idx_task_waits_task_id       | CREATE INDEX idx_task_waits_task_id ON public.task_waits USING btree (task_id)                                                 |
| uq_task_waits_github_link_id | CREATE UNIQUE INDEX uq_task_waits_github_link_id ON public.task_waits USING btree (github_link_id) WHERE (resolved_at IS NULL) |

## Relations

```mermaid
erDiagram

"public.task_waits" }o--|| "public.tasks" : "FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE"
"public.task_waits" }o--o| "public.task_github_links" : "FOREIGN KEY (github_link_id) REFERENCES task_github_links(id) ON DELETE CASCADE"

"public.task_waits" {
  uuid id
  text task_id FK
  text body
  date follow_up_date
  timestamp_with_time_zone resolved_at
  timestamp_with_time_zone acknowledged_at
  timestamp_with_time_zone created_at
  text github_link_id FK
}
"public.task_github_links" {
  text id
  text task_id FK
  text owner
  text repo
  integer number
  text kind
  text url
  text state
  text title
  timestamp_with_time_zone last_synced_at
  timestamp_with_time_zone created_at
  timestamp_with_time_zone updated_at
  text etag
  bigint seq
  text role
  text__ notify_events
  integer comments_count
  timestamp_with_time_zone github_updated_at
  text state_reason
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
  uuid description_template_id FK
}
```

---

> Generated by [tbls](https://github.com/k1LoW/tbls)
