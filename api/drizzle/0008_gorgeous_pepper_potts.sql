ALTER TABLE "task_github_links" ADD CONSTRAINT "task_github_links_state_kind_check" CHECK ("task_github_links"."kind" = 'pull_request' OR "task_github_links"."state" <> 'merged');
