CREATE TABLE "tq_images" (
	"id" text PRIMARY KEY NOT NULL,
	"r2_key" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tq_images_r2_key_unique" UNIQUE("r2_key")
);
--> statement-breakpoint
CREATE TABLE "tq_labels" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tq_labels_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "tq_oauth_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text DEFAULT 'google_calendar' NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tq_projects" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"start_date" date,
	"target_date" date,
	"color" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tq_recurrence_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"interval" integer DEFAULT 1 NOT NULL,
	"days_of_week" integer[],
	"day_of_month" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tq_schedules" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"recurrence_rule_id" text,
	"context" text DEFAULT 'personal' NOT NULL,
	"color" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tq_task_comments" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tq_task_labels" (
	"task_id" text NOT NULL,
	"label_id" text NOT NULL,
	CONSTRAINT "tq_task_labels_task_id_label_id_pk" PRIMARY KEY("task_id","label_id")
);
--> statement-breakpoint
CREATE TABLE "tq_task_pages" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"title" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tq_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'todo' NOT NULL,
	"start_date" date,
	"due_date" date,
	"estimated_minutes" integer,
	"parent_id" text,
	"project_id" text,
	"recurrence_rule_id" text,
	"context" text DEFAULT 'personal' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tq_time_blocks" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone,
	"is_auto_scheduled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tq_today_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"date" date NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tq_schedules" ADD CONSTRAINT "tq_schedules_recurrence_rule_id_tq_recurrence_rules_id_fk" FOREIGN KEY ("recurrence_rule_id") REFERENCES "public"."tq_recurrence_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tq_task_comments" ADD CONSTRAINT "tq_task_comments_task_id_tq_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tq_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tq_task_labels" ADD CONSTRAINT "tq_task_labels_task_id_tq_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tq_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tq_task_labels" ADD CONSTRAINT "tq_task_labels_label_id_tq_labels_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."tq_labels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tq_task_pages" ADD CONSTRAINT "tq_task_pages_task_id_tq_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tq_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tq_tasks" ADD CONSTRAINT "tq_tasks_parent_id_tq_tasks_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."tq_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tq_tasks" ADD CONSTRAINT "tq_tasks_project_id_tq_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."tq_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tq_tasks" ADD CONSTRAINT "tq_tasks_recurrence_rule_id_tq_recurrence_rules_id_fk" FOREIGN KEY ("recurrence_rule_id") REFERENCES "public"."tq_recurrence_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tq_time_blocks" ADD CONSTRAINT "tq_time_blocks_task_id_tq_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tq_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tq_today_tasks" ADD CONSTRAINT "tq_today_tasks_task_id_tq_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tq_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_images_r2_key" ON "tq_images" USING btree ("r2_key");--> statement-breakpoint
CREATE INDEX "idx_projects_status" ON "tq_projects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_projects_sort_order" ON "tq_projects" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "idx_schedules_recurrence_rule_id" ON "tq_schedules" USING btree ("recurrence_rule_id");--> statement-breakpoint
CREATE INDEX "idx_schedules_context" ON "tq_schedules" USING btree ("context");--> statement-breakpoint
CREATE INDEX "idx_task_comments_task_id" ON "tq_task_comments" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "idx_task_comments_created_at" ON "tq_task_comments" USING btree ("task_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_task_labels_task_id" ON "tq_task_labels" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "idx_task_labels_label_id" ON "tq_task_labels" USING btree ("label_id");--> statement-breakpoint
CREATE INDEX "idx_task_pages_task_id" ON "tq_task_pages" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_parent_id" ON "tq_tasks" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_status" ON "tq_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_tasks_start_date" ON "tq_tasks" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "idx_tasks_due_date" ON "tq_tasks" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_tasks_project_id" ON "tq_tasks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_project_status" ON "tq_tasks" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "idx_time_blocks_task_id" ON "tq_time_blocks" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "idx_time_blocks_date_range" ON "tq_time_blocks" USING btree ("start_time","end_time");
