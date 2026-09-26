ALTER TABLE "images" RENAME TO "assets";--> statement-breakpoint
ALTER TABLE "assets" RENAME CONSTRAINT "images_pkey" TO "assets_pkey";--> statement-breakpoint
ALTER TABLE "assets" RENAME CONSTRAINT "images_r2_key_unique" TO "assets_r2_key_unique";--> statement-breakpoint
ALTER INDEX "idx_images_r2_key" RENAME TO "idx_assets_r2_key";--> statement-breakpoint
UPDATE "tasks" SET "description" = replace("description", '](/api/images/', '](/api/assets/') WHERE "description" LIKE '%](/api/images/%';--> statement-breakpoint
UPDATE "task_comments" SET "content" = replace("content", '](/api/images/', '](/api/assets/') WHERE "content" LIKE '%](/api/images/%';--> statement-breakpoint
UPDATE "task_pages" SET "content" = replace("content", '](/api/images/', '](/api/assets/') WHERE "content" LIKE '%](/api/images/%';
