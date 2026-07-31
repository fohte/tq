import { sql } from 'drizzle-orm'
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core'

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
    unique('uq_calendar_subscriptions_oauth_token_calendar').on(
      table.oauthTokenId,
      table.calendarId,
    ),
    index('idx_calendar_subscriptions_oauth_token_id').on(table.oauthTokenId),
  ],
)
