ALTER TABLE "github_sync_rules" ADD COLUMN "seq" bigint;--> statement-breakpoint
UPDATE "github_sync_rules" AS t SET "seq" = ordered.rn
FROM (SELECT "id", row_number() OVER (ORDER BY "created_at", "id") AS rn FROM "github_sync_rules") AS ordered
WHERE ordered."id" = t."id";--> statement-breakpoint
ALTER TABLE "github_sync_rules" ALTER COLUMN "seq" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "github_sync_rules" ALTER COLUMN "seq" ADD GENERATED ALWAYS AS IDENTITY (sequence name "github_sync_rules_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
SELECT setval(
  'github_sync_rules_seq_seq',
  GREATEST(COALESCE((SELECT MAX("seq") FROM "github_sync_rules"), 1), 1),
  EXISTS (SELECT 1 FROM "github_sync_rules")
);
