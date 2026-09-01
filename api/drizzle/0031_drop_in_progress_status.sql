UPDATE "tasks" SET "status" = 'todo' WHERE "status" = 'in_progress';--> statement-breakpoint
-- A saved view with an existing `is:todo` token just drops the now-redundant
-- `is:in_progress`; one without it gets `is:in_progress` renamed to
-- `is:todo`, since those tasks moved there above.
UPDATE "saved_views"
SET "query" = trim(regexp_replace(
  CASE
    WHEN "query" ~ '\yis:todo\y' THEN regexp_replace("query", '\s*\yis:in_progress\y', '', 'g')
    ELSE regexp_replace("query", '\yis:in_progress\y', 'is:todo', 'g')
  END,
  '\s+', ' ', 'g'
))
WHERE "query" ~ '\yis:in_progress\y';
