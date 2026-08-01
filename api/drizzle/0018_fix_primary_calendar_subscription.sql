-- Drops 'primary' rows that duplicate an already-subscribed real calendar id
-- (the id is the account's email for a personal Google Calendar), so events
-- fetched for that calendar stop appearing twice.
DELETE FROM "calendar_subscriptions" cs
USING "oauth_tokens" ot
WHERE cs."oauth_token_id" = ot."id"
  AND cs."calendar_id" = 'primary'
  AND EXISTS (
    SELECT 1 FROM "calendar_subscriptions" cs2
    WHERE cs2."oauth_token_id" = cs."oauth_token_id"
      AND cs2."calendar_id" = ot."account_label"
  );--> statement-breakpoint
-- Rewrites the remaining 'primary' rows (no sibling row for the real id) to
-- the real calendar id, so they resolve against calendarList.list() entries
-- and the settings screen can show/unsubscribe them like any other calendar.
UPDATE "calendar_subscriptions" cs
SET "calendar_id" = ot."account_label"
FROM "oauth_tokens" ot
WHERE cs."oauth_token_id" = ot."id"
  AND cs."calendar_id" = 'primary'
  AND ot."account_label" IS NOT NULL;
