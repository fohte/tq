# public.task_description_templates

## Description

Templates for structuring task descriptions.

## Columns

| Name        | Type                     | Default           | Nullable | Children                        | Parents | Comment                                                                           |
| ----------- | ------------------------ | ----------------- | -------- | ------------------------------- | ------- | --------------------------------------------------------------------------------- |
| id          | uuid                     | gen_random_uuid() | false    | [public.tasks](public.tasks.md) |         |                                                                                   |
| name        | text                     |                   | false    |                                 |         | Unique name used to look up a description template.                               |
| when_to_use | text                     |                   | false    |                                 |         | Type of work for which the template should be selected.                           |
| body        | text                     |                   | false    |                                 |         | Markdown skeleton intended for a task description.                                |
| guide       | text                     |                   | false    |                                 |         | Writing instructions for completing each section of the body.                     |
| is_default  | boolean                  | false             | false    |                                 |         | Whether the template is selected by default; at most one template may be default. |
| created_at  | timestamp with time zone | now()             | false    |                                 |         |                                                                                   |
| updated_at  | timestamp with time zone | now()             | false    |                                 |         |                                                                                   |

## Constraints

| Name                                            | Type        | Definition           |
| ----------------------------------------------- | ----------- | -------------------- |
| task_description_templates_body_not_null        | n           | NOT NULL body        |
| task_description_templates_created_at_not_null  | n           | NOT NULL created_at  |
| task_description_templates_guide_not_null       | n           | NOT NULL guide       |
| task_description_templates_id_not_null          | n           | NOT NULL id          |
| task_description_templates_is_default_not_null  | n           | NOT NULL is_default  |
| task_description_templates_name_not_null        | n           | NOT NULL name        |
| task_description_templates_updated_at_not_null  | n           | NOT NULL updated_at  |
| task_description_templates_when_to_use_not_null | n           | NOT NULL when_to_use |
| task_description_templates_pkey                 | PRIMARY KEY | PRIMARY KEY (id)     |
| task_description_templates_name_unique          | UNIQUE      | UNIQUE (name)        |

## Indexes

| Name                                      | Definition                                                                                                                                            |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| task_description_templates_pkey           | CREATE UNIQUE INDEX task_description_templates_pkey ON public.task_description_templates USING btree (id)                                             |
| task_description_templates_name_unique    | CREATE UNIQUE INDEX task_description_templates_name_unique ON public.task_description_templates USING btree (name)                                    |
| task_description_templates_default_unique | CREATE UNIQUE INDEX task_description_templates_default_unique ON public.task_description_templates USING btree (is_default) WHERE (is_default = true) |

## Relations

```mermaid
erDiagram

"public.tasks" }o--o| "public.task_description_templates" : "FOREIGN KEY (description_template_id) REFERENCES task_description_templates(id) ON DELETE SET NULL"

"public.task_description_templates" {
  uuid id
  text name
  text when_to_use
  text body
  text guide
  boolean is_default
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
