import type { Result, ResultAsync } from 'neverthrow'

import type { oauthTokens } from '#db/schema'
import type {
  AccountIdentityError,
  IntegrationConfigError,
  TokenRefreshError,
} from '#integrations/errors'
import type { TokenExchangeError } from '#lib/fetch-json'

export type OAuthTokenRow = typeof oauthTokens.$inferSelect

export interface OAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}

export interface OAuthTokenPayload {
  accessToken: string
  refreshToken?: string
  expiresAt?: Date
}

export type ConnectionStatus =
  { connected: false } | { connected: true; login?: string }

/**
 * One connected account, scoped to a single provider in
 * `IntegrationListItem.accounts`. `id` is `oauthTokens.id` (a surrogate
 * key), not the provider-specific `accountId` — GitHub's `accountId` is an
 * empty-string sentinel and can't be carried in a URL path, but every row
 * still has a real UUID `id` to disconnect by
 * (`DELETE /api/integrations/:id/accounts/:accountId`). `label` is the
 * account's display name: GitHub's live-checked `login`, or Google's stored
 * `accountLabel` (email); null when neither is available.
 */
export interface IntegrationAccount {
  id: string
  label: string | null
}

/**
 * One row of `GET /api/integrations`. `configured` reflects whether the
 * provider's OAuth env vars are currently set; `accounts` lists every
 * currently connected (and, for a provider with `checkConnection`, still
 * valid) account. The two are independent: a token stored while env vars
 * were set can outlive their removal, so a non-empty `accounts` alongside
 * `configured: false` is possible for a provider with no `checkConnection`
 * (e.g. Google Calendar). `supportsMultipleAccounts` mirrors whether the
 * provider has an `IntegrationOAuth.identifyAccount` hook.
 */
export interface IntegrationListItem {
  id: string
  displayName: string
  configured: boolean
  supportsMultipleAccounts: boolean
  accounts: IntegrationAccount[]
}

export interface OAuthAccountIdentity {
  accountId: string
  accountLabel: string
}

export interface IntegrationOAuth {
  authorizationEndpoint: string
  scope: string
  /** Static params beyond client_id/redirect_uri/scope, e.g. Google's `access_type`/`prompt`. */
  extraAuthorizationParams?: Record<string, string>
  getConfig: () => Result<OAuthConfig, IntegrationConfigError>
  exchangeCode: (
    code: string,
    config: OAuthConfig,
  ) => ResultAsync<OAuthTokenPayload, TokenExchangeError>
  /** Omitted for providers whose tokens never expire (e.g. GitHub OAuth Apps). */
  refresh?: (
    refreshToken: string,
    config: OAuthConfig,
  ) => ResultAsync<OAuthTokenPayload, TokenRefreshError>
  /**
   * Identifies the connected account right after code exchange, so the
   * common OAuth layer can store multiple accounts side by side for this
   * provider (see oauthTokens.accountId in db/schema.ts). Omitted for
   * providers with no such identity (e.g. GitHub), whose token row keeps the
   * `accountId` sentinel instead.
   */
  identifyAccount?: (
    accessToken: string,
  ) => ResultAsync<OAuthAccountIdentity, AccountIdentityError>
}

export interface CalendarEventsCapability {
  getEvents: (
    accessToken: string,
    params: { calendarId: string; timeMin: string; timeMax: string },
  ) => ResultAsync<Omit<ExternalEvent, 'accountId' | 'accountLabel'>[], Error>
}

export interface ExternalEvent {
  id: string
  summary: string
  startTime: string
  endTime: string
  isAllDay: boolean
  source: string
  accountId: string
  accountLabel: string | null
}

export interface IntegrationProvider {
  id: string
  displayName: string
  oauth: IntegrationOAuth
  /**
   * Live-checks the stored token against the provider's API. A `connected:
   * false` result tells the common OAuth layer to drop the stored token.
   * Omitted for providers with no such check (e.g. Google Calendar, which
   * relies on lazy token refresh instead).
   */
  checkConnection?: (
    token: OAuthTokenRow,
  ) => ResultAsync<ConnectionStatus, Error>
  capabilities?: {
    calendarEvents?: CalendarEventsCapability
  }
}
