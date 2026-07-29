CREATE TABLE "task_github_links" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"owner" text NOT NULL,
	"repo" text NOT NULL,
	"number" integer NOT NULL,
	"kind" text NOT NULL,
	"url" text NOT NULL,
	"state" text NOT NULL,
	"title" text NOT NULL,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_github_links_task_id_unique" UNIQUE("task_id"),
	CONSTRAINT "uq_task_github_links_repo_number" UNIQUE("owner","repo","number")
);
--> statement-breakpoint
ALTER TABLE "task_github_links" ADD CONSTRAINT "task_github_links_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
