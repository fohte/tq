# tq_test

## Tables

| Name                                                    | Columns | Comment | Type       |
| ------------------------------------------------------- | ------- | ------- | ---------- |
| [public.images](public.images.md)                       | 5       |         | BASE TABLE |
| [public.labels](public.labels.md)                       | 4       |         | BASE TABLE |
| [public.oauth_tokens](public.oauth_tokens.md)           | 9       |         | BASE TABLE |
| [public.projects](public.projects.md)                   | 10      |         | BASE TABLE |
| [public.recurrence_rules](public.recurrence_rules.md)   | 7       |         | BASE TABLE |
| [public.schedules](public.schedules.md)                 | 9       |         | BASE TABLE |
| [public.task_comments](public.task_comments.md)         | 5       |         | BASE TABLE |
| [public.task_labels](public.task_labels.md)             | 2       |         | BASE TABLE |
| [public.task_pages](public.task_pages.md)               | 7       |         | BASE TABLE |
| [public.tasks](public.tasks.md)                         | 15      |         | BASE TABLE |
| [public.time_blocks](public.time_blocks.md)             | 7       |         | BASE TABLE |
| [public.today_tasks](public.today_tasks.md)             | 6       |         | BASE TABLE |
| [public.edits](public.edits.md)                         | 10      |         | BASE TABLE |
| [public.task_github_links](public.task_github_links.md) | 14      |         | BASE TABLE |
| [public.task_links](public.task_links.md)               | 3       |         | BASE TABLE |

## Relations

```mermaid
erDiagram

"public.schedules" }o--o| "public.recurrence_rules" : "FOREIGN KEY (recurrence_rule_id) REFERENCES recurrence_rules(id) ON DELETE SET NULL"
"public.task_comments" }o--|| "public.tasks" : "FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE"
"public.task_labels" }o--|| "public.labels" : "FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE CASCADE"
"public.task_labels" }o--|| "public.tasks" : "FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE"
"public.task_pages" }o--|| "public.tasks" : "FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE"
"public.tasks" }o--o| "public.projects" : "FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL"
"public.tasks" }o--o| "public.recurrence_rules" : "FOREIGN KEY (recurrence_rule_id) REFERENCES recurrence_rules(id) ON DELETE SET NULL"
"public.tasks" }o--o| "public.tasks" : "FOREIGN KEY (parent_id) REFERENCES tasks(id) ON DELETE SET NULL"
"public.time_blocks" }o--|| "public.tasks" : "FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE"
"public.today_tasks" }o--|| "public.tasks" : "FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE"
"public.edits" }o--o| "public.task_comments" : "FOREIGN KEY (comment_id) REFERENCES task_comments(id) ON DELETE CASCADE"
"public.edits" }o--o| "public.task_pages" : "FOREIGN KEY (page_id) REFERENCES task_pages(id) ON DELETE CASCADE"
"public.edits" }o--|| "public.tasks" : "FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE"
"public.task_github_links" |o--|| "public.tasks" : "FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE"
"public.task_links" }o--|| "public.tasks" : "FOREIGN KEY (source_task_id) REFERENCES tasks(id) ON DELETE CASCADE"
"public.task_links" }o--|| "public.tasks" : "FOREIGN KEY (target_task_id) REFERENCES tasks(id) ON DELETE CASCADE"

"public.images" {
  text id
  text r2_key
  text content_type
  integer size_bytes
  timestamp_with_time_zone created_at
}
"public.labels" {
  text id
  text name
  text color
  timestamp_with_time_zone created_at
}
"public.oauth_tokens" {
  text id
  text provider
  text access_token
  text refresh_token
  timestamp_with_time_zone expires_at
  timestamp_with_time_zone created_at
  timestamp_with_time_zone updated_at
  text account_id
  text account_label
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
  integer sort_order
  timestamp_with_time_zone created_at
  timestamp_with_time_zone updated_at
  integer number
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
}
"public.task_links" {
  text source_task_id FK
  text target_task_id FK
  timestamp_with_time_zone created_at
}
```

---

> Generated by [tbls](https://github.com/k1LoW/tbls)
