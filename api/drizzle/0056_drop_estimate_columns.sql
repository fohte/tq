DROP TABLE "scheduling_settings" CASCADE;--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN "estimated_minutes";--> statement-breakpoint
ALTER TABLE "recurring_task_templates" DROP COLUMN "estimated_minutes";
