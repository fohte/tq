CREATE TABLE "project_field_options" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"field_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_project_field_options_field_id_name" UNIQUE("field_id","name"),
	CONSTRAINT "uq_project_field_options_id_field_id" UNIQUE("id","field_id")
);
--> statement-breakpoint
CREATE TABLE "project_fields" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'single_select' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_project_fields_project_id_name" UNIQUE("project_id","name"),
	CONSTRAINT "uq_project_fields_id_project_id" UNIQUE("id","project_id"),
	CONSTRAINT "project_fields_type_check" CHECK ("project_fields"."type" = 'single_select')
);
--> statement-breakpoint
ALTER TABLE "project_field_options" ADD CONSTRAINT "project_field_options_field_id_project_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."project_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_fields" ADD CONSTRAINT "project_fields_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
