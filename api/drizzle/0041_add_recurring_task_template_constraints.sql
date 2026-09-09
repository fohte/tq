DROP INDEX "idx_recurring_task_templates_recurrence_rule_id";--> statement-breakpoint
ALTER TABLE "recurring_task_templates" ADD CONSTRAINT "recurring_task_templates_recurrence_rule_id_unique" UNIQUE("recurrence_rule_id");--> statement-breakpoint
ALTER TABLE "recurring_task_templates" ADD CONSTRAINT "recurring_task_templates_start_offset_days_check" CHECK ("recurring_task_templates"."start_offset_days" >= 0);
