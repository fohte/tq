# tq_test

## Tables

| Name                                                                                | Columns | Comment | Type       |
| ----------------------------------------------------------------------------------- | ------- | ------- | ---------- |
| [public.images](public.images.md)                                                   | 5       |         | BASE TABLE |
| [public.labels](public.labels.md)                                                   | 4       |         | BASE TABLE |
| [public.oauth_tokens](public.oauth_tokens.md)                                       | 9       |         | BASE TABLE |
| [public.projects](public.projects.md)                                               | 10      |         | BASE TABLE |
| [public.recurrence_rules](public.recurrence_rules.md)                               | 7       |         | BASE TABLE |
| [public.schedules](public.schedules.md)                                             | 9       |         | BASE TABLE |
| [public.task_comments](public.task_comments.md)                                     | 5       |         | BASE TABLE |
| [public.task_labels](public.task_labels.md)                                         | 2       |         | BASE TABLE |
| [public.task_pages](public.task_pages.md)                                           | 8       |         | BASE TABLE |
| [public.tasks](public.tasks.md)                                                     | 15      |         | BASE TABLE |
| [public.time_blocks](public.time_blocks.md)                                         | 7       |         | BASE TABLE |
| [public.today_tasks](public.today_tasks.md)                                         | 6       |         | BASE TABLE |
| [public.edits](public.edits.md)                                                     | 10      |         | BASE TABLE |
| [public.task_github_links](public.task_github_links.md)                             | 14      |         | BASE TABLE |
| [public.task_links](public.task_links.md)                                           | 3       |         | BASE TABLE |
| [public.github_sync_rule_ignored_issues](public.github_sync_rule_ignored_issues.md) | 6       |         | BASE TABLE |
| [public.github_sync_rules](public.github_sync_rules.md)                             | 11      |         | BASE TABLE |
| [public.calendar_subscriptions](public.calendar_subscriptions.md)                   | 7       |         | BASE TABLE |
| [public.task_events](public.task_events.md)                                         | 12      |         | BASE TABLE |
| [public.scheduling_settings](public.scheduling_settings.md)                         | 8       |         | BASE TABLE |
| [public.agent_sessions](public.agent_sessions.md)                                   | 12      |         | BASE TABLE |
| [public.task_agent_sessions](public.task_agent_sessions.md)                         | 2       |         | BASE TABLE |
| [public.saved_views](public.saved_views.md)                                         | 7       |         | BASE TABLE |

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
"public.github_sync_rule_ignored_issues" }o--|| "public.github_sync_rules" : "FOREIGN KEY (rule_id) REFERENCES github_sync_rules(id) ON DELETE CASCADE"
"public.github_sync_rules" }o--|| "public.projects" : "FOREIGN KEY (target_project_id) REFERENCES projects(id) ON DELETE CASCADE"
"public.calendar_subscriptions" }o--|| "public.oauth_tokens" : "FOREIGN KEY (oauth_token_id) REFERENCES oauth_tokens(id) ON DELETE CASCADE"
"public.task_events" }o--|| "public.tasks" : "FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE"
"public.task_agent_sessions" }o--|| "public.tasks" : "FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE"
"public.task_agent_sessions" }o--|| "public.agent_sessions" : "FOREIGN KEY (agent_session_id) REFERENCES agent_sessions(id) ON DELETE CASCADE"

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
  text format
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
"public.github_sync_rule_ignored_issues" {
  text id
  text rule_id FK
  text owner
  text repo
  integer number
  timestamp_with_time_zone created_at
}
"public.github_sync_rules" {
  text id
  text scope
  text org
  text repo
  text trigger
  text target_project_id FK
  boolean enabled
  boolean seed_ignore_on_next_sync
  timestamp_with_time_zone created_at
  timestamp_with_time_zone updated_at
  bigint seq
}
"public.calendar_subscriptions" {
  text id
  text oauth_token_id FK
  text calendar_id
  text display_name
  text color
  timestamp_with_time_zone created_at
  timestamp_with_time_zone updated_at
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
}
"public.scheduling_settings" {
  text id
  text working_hours_start
  text working_hours_end
  integer minimum_block_minutes
  boolean auto_reschedule_on_gcal_change
  text default_context
  timestamp_with_time_zone created_at
  timestamp_with_time_zone updated_at
}
"public.agent_sessions" {
  text id
  text provider
  text session_id
  text context
  text cwd
  text label
  text last_message
  text custom_label
  timestamp_with_time_zone started_at
  timestamp_with_time_zone last_active_at
  timestamp_with_time_zone ended_at
  text parent_session_id
}
"public.task_agent_sessions" {
  text task_id FK
  text agent_session_id FK
}
"public.saved_views" {
  text id
  text name
  text query
  integer position
  text context
  timestamp_with_time_zone created_at
  timestamp_with_time_zone updated_at
}
```

---

> Generated by [tbls](https://github.com/k1LoW/tbls)
