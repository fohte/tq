import type { Result, ResultAsync } from 'neverthrow'

import type { oauthTokens } from '#db/schema'
import type {
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
 * One row of `GET /api/integrations`. `configured` reflects whether the
 * provider's OAuth env vars are currently set; `connected` reflects whether
 * a token is stored (and, for a provider with `checkConnection`, still
 * valid). The two are independent: a token stored while env vars were set
 * can outlive their removal, so `connected: true, configured: false` is
 * possible for a provider with no `checkConnection` (e.g. Google Calendar).
 */
export type IntegrationListItem = ConnectionStatus & {
  id: string
  displayName: string
  configured: boolean
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
}

export interface CalendarEventsCapability {
  getEvents: (
    accessToken: string,
    params: { calendarId: string; timeMin: string; timeMax: string },
  ) => ResultAsync<ExternalEvent[], Error>
}

export interface ExternalEvent {
  id: string
  summary: string
  startTime: string
  endTime: string
  isAllDay: boolean
  source: string
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
