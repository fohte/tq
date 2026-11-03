ALTER TABLE "tasks" ALTER COLUMN "commitment" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "commitment" DROP NOT NULL;
