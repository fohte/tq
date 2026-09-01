-- Custom SQL migration file, put your code below! -----
UPDATE "tasks" SET "status" = 'todo' WHERE "status" = 'in_progress';
