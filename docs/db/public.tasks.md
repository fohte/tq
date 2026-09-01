# public.tasks

## Columns

| Name               | Type                     | Default          | Nullable | Children                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Parents                                               | Comment |
| ------------------ | ------------------------ | ---------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------- |
| id                 | text                     |                  | false    | [public.task_comments](public.task_comments.md) [public.task_labels](public.task_labels.md) [public.task_pages](public.task_pages.md) [public.tasks](public.tasks.md) [public.time_blocks](public.time_blocks.md) [public.today_tasks](public.today_tasks.md) [public.edits](public.edits.md) [public.task_github_links](public.task_github_links.md) [public.task_links](public.task_links.md) [public.task_events](public.task_events.md) [public.task_agent_sessions](public.task_agent_sessions.md) [public.task_relations](public.task_relations.md) |                                                       |         |
| title              | text                     |                  | false    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |                                                       |         |
| description        | text                     |                  | true     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |                                                       |         |
| status             | text                     | 'todo'::text     | false    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |                                                       |         |
| start_date         | date                     |                  | true     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |                                                       |         |
| due_date           | date                     |                  | true     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |                                                       |         |
| estimated_minutes  | integer                  |                  | true     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |                                                       |         |
| parent_id          | text                     |                  | true     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | [public.tasks](public.tasks.md)                       |         |
| project_id         | text                     |                  | true     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | [public.projects](public.projects.md)                 |         |
| recurrence_rule_id | text                     |                  | true     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | [public.recurrence_rules](public.recurrence_rules.md) |         |
| context            | text                     | 'personal'::text | false    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |                                                       |         |
| created_at         | timestamp with time zone | now()            | false    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |                                                       |         |
| updated_at         | timestamp with time zone | now()            | false    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |                                                       |         |
| number             | integer                  |                  | false    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |                                                       |         |
| commitment         | text                     | 'inbox'::text    | false    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |                                                       |         |
| status_reason      | text                     |                  | true     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |                                                       |         |

## Constraints

| Name                                            | Type        | Definition                                                                          |
| ----------------------------------------------- | ----------- | ----------------------------------------------------------------------------------- |
| tasks_status_reason_check                       | CHECK       | CHECK (((status = 'completed'::text) OR (status_reason IS NULL)))                   |
| tasks_project_id_projects_id_fk                 | FOREIGN KEY | FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL                 |
| tasks_recurrence_rule_id_recurrence_rules_id_fk | FOREIGN KEY | FOREIGN KEY (recurrence_rule_id) REFERENCES recurrence_rules(id) ON DELETE SET NULL |
| tasks_parent_id_tasks_id_fk                     | FOREIGN KEY | FOREIGN KEY (parent_id) REFERENCES tasks(id) ON DELETE SET NULL                     |
| tasks_pkey                                      | PRIMARY KEY | PRIMARY KEY (id)                                                                    |
| tasks_number_unique                             | UNIQUE      | UNIQUE (number)                                                                     |

## Indexes

| Name                     | Definition                                                                             |
| ------------------------ | -------------------------------------------------------------------------------------- |
| tasks_pkey               | CREATE UNIQUE INDEX tasks_pkey ON public.tasks USING btree (id)                        |
| idx_tasks_parent_id      | CREATE INDEX idx_tasks_parent_id ON public.tasks USING btree (parent_id)               |
| idx_tasks_status         | CREATE INDEX idx_tasks_status ON public.tasks USING btree (status)                     |
| idx_tasks_start_date     | CREATE INDEX idx_tasks_start_date ON public.tasks USING btree (start_date)             |
| idx_tasks_due_date       | CREATE INDEX idx_tasks_due_date ON public.tasks USING btree (due_date)                 |
| idx_tasks_project_id     | CREATE INDEX idx_tasks_project_id ON public.tasks USING btree (project_id)             |
| idx_tasks_project_status | CREATE INDEX idx_tasks_project_status ON public.tasks USING btree (project_id, status) |
| tasks_number_unique      | CREATE UNIQUE INDEX tasks_number_unique ON public.tasks USING btree (number)           |
| idx_tasks_commitment     | CREATE INDEX idx_tasks_commitment ON public.tasks USING btree (commitment)             |

## Relations

```mermaid
erDiagram

"public.task_comments" }o--|| "public.tasks" : "FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE"
"public.task_labels" }o--|| "public.tasks" : "FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE"
"public.task_pages" }o--|| "public.tasks" : "FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE"
"public.tasks" }o--o| "public.tasks" : "FOREIGN KEY (parent_id) REFERENCES tasks(id) ON DELETE SET NULL"
"public.time_blocks" }o--|| "public.tasks" : "FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE"
"public.today_tasks" }o--|| "public.tasks" : "FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE"
"public.edits" }o--|| "public.tasks" : "FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE"
"public.task_github_links" }o--|| "public.tasks" : "FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE"
"public.task_links" }o--|| "public.tasks" : "FOREIGN KEY (source_task_id) REFERENCES tasks(id) ON DELETE CASCADE"
"public.task_links" }o--|| "public.tasks" : "FOREIGN KEY (target_task_id) REFERENCES tasks(id) ON DELETE CASCADE"
"public.task_events" }o--|| "public.tasks" : "FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE"
"public.task_agent_sessions" }o--|| "public.tasks" : "FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE"
"public.task_relations" }o--|| "public.tasks" : "FOREIGN KEY (source_task_id) REFERENCES tasks(id) ON DELETE CASCADE"
"public.task_relations" }o--|| "public.tasks" : "FOREIGN KEY (target_task_id) REFERENCES tasks(id) ON DELETE CASCADE"
"public.tasks" }o--o| "public.projects" : "FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL"
"public.tasks" }o--o| "public.recurrence_rules" : "FOREIGN KEY (recurrence_rule_id) REFERENCES recurrence_rules(id) ON DELETE SET NULL"

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
}
"public.task_comments" {
  text id
  text task_id FK
  text content
  timestamp_with_time_zone created_at
  timestamp_with_time_zone updated_at
}
"public.task_labels" {
  text task_id FK
  text label_id FK
}
"public.task_pages" {
  text id
  text task_id FK
  text title
  text content
  integer sort_order
  timestamp_with_time_zone created_at
  timestamp_with_time_zone updated_at
  text format
}
"public.time_blocks" {
  text id
  text task_id FK
  timestamp_with_time_zone start_time
  timestamp_with_time_zone end_time
  boolean is_auto_scheduled
  timestamp_with_time_zone created_at
  timestamp_with_time_zone updated_at
}
"public.today_tasks" {
  text id
  text task_id FK
  date date
  integer sort_order
  timestamp_with_time_zone created_at
  timestamp_with_time_zone updated_at
}
"public.edits" {
  bigint id
  text task_id FK
  text page_id FK
  text comment_id FK
  text action
  text field
  text author_kind
  text author_agent
  timestamp_with_time_zone created_at
  timestamp_with_time_zone updated_at
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
  text body
  text etag
  bigint seq
}
"public.task_links" {
  text source_task_id FK
  text target_task_id FK
  timestamp_with_time_zone created_at
}
"public.task_events" {
  bigint id
  text task_id FK
  text type
  text from_status
  text to_status
  text github_owner
  text github_repo
  integer github_number
  text github_kind
  text author_kind
  text author_agent
  timestamp_with_time_zone created_at
  text to_status_reason
}
"public.task_agent_sessions" {
  text task_id FK
  text agent_session_id FK
}
"public.task_relations" {
  text source_task_id FK
  text target_task_id FK
  text type
  timestamp_with_time_zone created_at
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
