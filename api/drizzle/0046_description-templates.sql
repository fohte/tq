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
--> statement-breakpoint
INSERT INTO "task_description_templates" (
	"id", "name", "when_to_use", "body", "guide", "is_default"
) VALUES (
	'00000000-0000-4000-8000-000000000001',
	'実装',
	'コードや設定の変更を伴い、PR が出る作業',
	E'## Why\n\n## What',
	E'Why: この作業が必要な理由と、解決する問題を書く。\nWhat: 変更する対象と内容を書く。',
	true
);
