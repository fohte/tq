import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core'

import { projects, tasks } from '#db/schema/core'

export const taskGithubLinks = pgTable(
  'task_github_links',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    taskId: text('task_id')
      .notNull()
      .unique()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    owner: text('owner').notNull(),
    repo: text('repo').notNull(),
    number: integer('number').notNull(),
    kind: text('kind', { enum: ['issue', 'pull_request'] }).notNull(),
    url: text('url').notNull(),
    state: text('state', { enum: ['open', 'closed', 'merged'] }).notNull(),
    title: text('title').notNull(),
    // `title`/`body`/`state` hold the GitHub values as of the last sync, not
    // the task's current values — the sync diffs a fresh fetch against these
    // to tell "GitHub changed" apart from "the task was edited in TQ".
    body: text('body'),
    // GitHub's ETag for the last fetch of this issue/PR, sent back as
    // `If-None-Match` on the next sync so an unchanged resource costs a bare
    // 304 instead of a full fetch (and doesn't count against GitHub's
    // primary rate limit).
    etag: text('etag'),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // At most one task may link to a given issue/PR.
    unique('uq_task_github_links_repo_number').on(
      table.owner,
      table.repo,
      table.number,
    ),
    // Only a pull request can be merged; a plain issue's state is always
    // open or closed.
    check(
      'task_github_links_state_kind_check',
      sql`${table.kind} = 'pull_request' OR ${table.state} <> 'merged'`,
    ),
  ],
)

export const githubSyncRules = pgTable(
  'github_sync_rules',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    scope: text('scope', { enum: ['all', 'org', 'repo'] }).notNull(),
    org: text('org'),
    repo: text('repo'),
    // Only 'assigned' exists today; kept as an enum column (not a boolean)
    // so a future 'created' trigger is an enum value, not a schema change.
    trigger: text('trigger', { enum: ['assigned'] })
      .notNull()
      .default('assigned'),
    targetProjectId: text('target_project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    enabled: boolean('enabled').notNull().default(true),
    // True until this rule's first sync pass runs; that pass seeds
    // `githubSyncRuleIgnoredIssues` with whatever currently matches instead
    // of creating tasks for it (see services/github-sync-rules.ts), then
    // flips this to false. Only relevant when the rule was created with
    // includeExisting=false.
    seedIgnoreOnNextSync: boolean('seed_ignore_on_next_sync')
      .notNull()
      .default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_github_sync_rules_enabled').on(table.enabled),
    index('idx_github_sync_rules_target_project_id').on(table.targetProjectId),
    check(
      'github_sync_rules_scope_target_check',
      sql`(${table.scope} = 'all' AND ${table.org} IS NULL AND ${table.repo} IS NULL)
        OR (${table.scope} = 'org' AND ${table.org} IS NOT NULL AND ${table.repo} IS NULL)
        OR (${table.scope} = 'repo' AND ${table.org} IS NOT NULL AND ${table.repo} IS NOT NULL)`,
    ),
  ],
)

export const githubSyncRuleIgnoredIssues = pgTable(
  'github_sync_rule_ignored_issues',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    ruleId: text('rule_id')
      .notNull()
      .references(() => githubSyncRules.id, { onDelete: 'cascade' }),
    owner: text('owner').notNull(),
    repo: text('repo').notNull(),
    number: integer('number').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('uq_github_sync_rule_ignored_issues').on(
      table.ruleId,
      table.owner,
      table.repo,
      table.number,
    ),
  ],
)

export const oauthTokens = pgTable(
  'oauth_tokens',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    provider: text('provider').notNull().default('google_calendar'),
    // Identifies which account a row belongs to for providers that support
    // multiple connected accounts (currently only google_calendar, keyed by
    // the stable `sub` from Google's UserInfo endpoint; see
    // IntegrationOAuth.identifyAccount in integrations/types.ts). GitHub has
    // no such identity and is intentionally kept single-account: its rows
    // use '' as a sentinel so the unique constraint below still caps it at
    // one row per provider.
    accountId: text('account_id').notNull(),
    // Human-facing label for the account (Google's email); null for
    // providers with no identifyAccount hook (e.g. GitHub).
    accountLabel: text('account_label'),
    accessToken: text('access_token').notNull(),
    // Nullable: GitHub OAuth App tokens have neither a refresh token nor an
    // expiry (see https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/token-expiration-and-revocation).
    refreshToken: text('refresh_token'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('uq_oauth_tokens_provider_account_id').on(
      table.provider,
      table.accountId,
    ),
    // Exempts providers with no `oauth.refresh` in api/src/integrations/
    // (tokens that never expire, so refresh metadata is meaningless). Add
    // such a provider's id to this OR clause alongside 'github'.
    check(
      'oauth_tokens_refresh_metadata_required',
      sql`${table.provider} = 'github' OR (${table.refreshToken} IS NOT NULL AND ${table.expiresAt} IS NOT NULL)`,
    ),
  ],
)

// One row per calendar a user has chosen to see in tq (existence = subscribed;
// there is no boolean column). No code path may treat zero rows for an
// account as "show its primary calendar" — that would make it impossible to
// express "hide every calendar for this account".
export const calendarSubscriptions = pgTable(
  'calendar_subscriptions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    oauthTokenId: text('oauth_token_id')
      .notNull()
      .references(() => oauthTokens.id, { onDelete: 'cascade' }),
    calendarId: text('calendar_id').notNull(),
    // Cached snapshot of the calendar's Google-side summary/backgroundColor,
    // refreshed whenever the subscription is written (see
    // integrations/google-calendar/subscriptions.ts) rather than on every
    // events fetch, so /api/calendar/events never has to call
    // calendarList.list on its 60s poll path.
    displayName: text('display_name'),
    color: text('color'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // No separate oauthTokenId-only index: this composite unique index's
    // leftmost-prefix already covers every query in
    // integrations/google-calendar/subscriptions.ts, all of which filter by
    // oauthTokenId alone or by (oauthTokenId, calendarId).
    unique('uq_calendar_subscriptions_oauth_token_calendar').on(
      table.oauthTokenId,
      table.calendarId,
    ),
  ],
)
