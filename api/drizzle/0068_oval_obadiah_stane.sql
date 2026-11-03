CREATE TABLE "priority_settings" (
	"priority" integer,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"sort_order" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "priority_settings_priority_check" CHECK ("priority_settings"."priority" IS NULL OR "priority_settings"."priority" BETWEEN -1 AND 2)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "priority_settings_priority_unique" ON "priority_settings" USING btree ("priority") WHERE "priority_settings"."priority" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "priority_settings_inbox_unique" ON "priority_settings" USING btree ("priority") WHERE "priority_settings"."priority" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "priority_settings_sort_order_unique" ON "priority_settings" USING btree ("sort_order");--> statement-breakpoint
INSERT INTO "priority_settings" ("priority", "name", "description", "sort_order") VALUES
	(2, '最優先', '', 0),
	(1, '早めにやる', '', 1),
	(0, 'やりたい', '', 2),
	(NULL, 'Inbox', '', 3),
	(-1, '後回し', '', 4);
