CREATE TABLE "task_description_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"when_to_use" text NOT NULL,
	"body" text NOT NULL,
	"guide" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_description_templates_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "task_description_templates_default_unique" ON "task_description_templates" USING btree ("is_default") WHERE "task_description_templates"."is_default" = true;
