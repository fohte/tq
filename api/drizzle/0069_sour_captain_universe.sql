DROP INDEX "priority_settings_priority_unique";--> statement-breakpoint
DROP INDEX "priority_settings_inbox_unique";--> statement-breakpoint
ALTER TABLE "priority_settings" ADD COLUMN "id" bigint PRIMARY KEY NOT NULL GENERATED ALWAYS AS IDENTITY (sequence name "priority_settings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "priority_settings" ADD CONSTRAINT "priority_settings_priority_unique" UNIQUE NULLS NOT DISTINCT("priority");--> statement-breakpoint
ALTER TABLE "priority_settings" ADD CONSTRAINT "priority_settings_name_check" CHECK ("priority_settings"."name" <> '');
