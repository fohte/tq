import { fromThrowable, type Result } from 'neverthrow'
import { z } from 'zod'

import { getOAuthEnvConfig } from '#integrations/env-config'
import {
  AccountIdentityError,
  type IntegrationConfigError,
  TokenRefreshError,
} from '#integrations/errors'
import { ensureValidAccessToken, listAccountTokens } from '#integrations/oauth'
import type { ExternalEvent, IntegrationProvider } from '#integrations/types'
import { fetchJson, TokenExchangeError } from '#lib/fetch-json'

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const GOOGLE_CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3'
const GOOGLE_USERINFO_ENDPOINT =
  'https://openidconnect.googleapis.com/v1/userinfo'
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly openid email'
const PROVIDER_ID = 'google_calendar'

export class CalendarApiError extends Error {
  constructor(message: string, cause?: unknown) {
    super(`Google Calendar API error: ${message}`, { cause })
    this.name = 'CalendarApiError'
  }
}

const tokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number(),
})

const refreshTokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  expires_in: z.number(),
})

const googleOAuthErrorResponseSchema = z.object({
  error: z.string(),
})

const userInfoResponseSchema = z.object({
  sub: z.string(),
  email: z.string(),
})

const tryParseJson = fromThrowable(
  (raw: string) => JSON.parse(raw) as unknown,
  () => undefined,
)

// Google's refresh-token grant returns other OAuth error codes (e.g.
// `invalid_client` from a misconfigured client secret) as a 4xx too, so a
// bare status-code check can't tell a revoked/expired refresh token apart
// from a server misconfiguration. Only `invalid_grant` is the former.
function isInvalidGrantResponse(responseText: string): boolean {
  const parsed = tryParseJson(responseText)
    .map((data) => googleOAuthErrorResponseSchema.safeParse(data))
    .unwrapOr(undefined)
  return parsed?.success === true && parsed.data.error === 'invalid_grant'
}

const googleCalendarEventSchema = z.object({
  id: z.string(),
  summary: z.string().optional(),
  start: z.object({
    dateTime: z.string().optional(),
    date: z.string().optional(),
  }),
  end: z.object({
    dateTime: z.string().optional(),
    date: z.string().optional(),
  }),
})

const googleCalendarEventsResponseSchema = z.object({
  items: z.array(googleCalendarEventSchema).optional(),
})

export const googleCalendarProvider = {
  id: PROVIDER_ID,
  displayName: 'Google Calendar',
  oauth: {
    authorizationEndpoint: GOOGLE_AUTH_ENDPOINT,
    scope: SCOPES,
    extraAuthorizationParams: {
      response_type: 'code',
      access_type: 'offline',
      prompt: 'select_account consent',
    },
    getConfig: () => getOAuthEnvConfig('GOOGLE'),
    exchangeCode: (code, config) =>
      fetchJson(
        GOOGLE_TOKEN_ENDPOINT,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: config.clientId,
            client_secret: config.clientSecret,
            redirect_uri: config.redirectUri,
            grant_type: 'authorization_code',
          }),
        },
        tokenResponseSchema,
        (message, cause, rejected) =>
          new TokenExchangeError(message, cause, rejected),
      ).map((data) => ({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
      })),
    refresh: (refreshToken, config) =>
      fetchJson(
        GOOGLE_TOKEN_ENDPOINT,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
          }),
        },
        refreshTokenResponseSchema,
        (message, cause, rejected) =>
          new TokenRefreshError(
            message,
            cause,
            rejected === true && isInvalidGrantResponse(message),
          ),
      ).map((data) => ({
        accessToken: data.access_token,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
        ...(data.refresh_token != null
          ? { refreshToken: data.refresh_token }
          : {}),
      })),
    identifyAccount: (accessToken) =>
      fetchJson(
        GOOGLE_USERINFO_ENDPOINT,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${accessToken}` },
        },
        userInfoResponseSchema,
        (message, cause) => new AccountIdentityError(message, cause),
      ).map((data) => ({ accountId: data.sub, accountLabel: data.email })),
  },
  capabilities: {
    calendarEvents: {
      getEvents: (accessToken, { calendarId, timeMin, timeMax }) => {
        const params = new URLSearchParams({
          timeMin,
          timeMax,
          singleEvents: 'true',
          orderBy: 'startTime',
        })

        return fetchJson(
          `${GOOGLE_CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
          {
            method: 'GET',
            headers: { Authorization: `Bearer ${accessToken}` },
          },
          googleCalendarEventsResponseSchema,
          (message, cause) => new CalendarApiError(message, cause),
        ).map((data) =>
          (data.items ?? []).map(
            (event): Omit<ExternalEvent, 'accountId' | 'accountLabel'> => ({
              id: event.id,
              summary: event.summary ?? '(No title)',
              startTime: event.start.dateTime ?? event.start.date ?? '',
              endTime: event.end.dateTime ?? event.end.date ?? '',
              isAllDay: event.start.dateTime == null,
              source: PROVIDER_ID,
            }),
          ),
        )
      },
    },
  },
} satisfies IntegrationProvider

export type AccountEventsError =
  IntegrationConfigError | TokenRefreshError | CalendarApiError

export interface AccountEventsResult {
  accountId: string
  accountLabel: string | null
  result: Result<ExternalEvent[], AccountEventsError>
}

// Resolves to a best-effort per-account result rather than a single Result,
// mirroring getIntegrationSummary in oauth.ts: one account's failure (e.g.
// a revoked refresh token) must not prevent the other connected accounts'
// events from being returned.
export async function getEvents(
  timeMin: string,
  timeMax: string,
): Promise<AccountEventsResult[]> {
  const tokens = await listAccountTokens(googleCalendarProvider).match(
    (rows) => rows,
    () => [],
  )

  return Promise.all(
    tokens.map(async (token) => ({
      accountId: token.accountId,
      accountLabel: token.accountLabel,
      result: await ensureValidAccessToken(googleCalendarProvider, token)
        .andThen((accessToken) =>
          googleCalendarProvider.capabilities.calendarEvents.getEvents(
            accessToken,
            {
              calendarId: 'primary',
              timeMin,
              timeMax,
            },
          ),
        )
        .map((events) =>
          events.map((event) => ({
            ...event,
            accountId: token.accountId,
            accountLabel: token.accountLabel,
          })),
        ),
    })),
  )
}

export interface PartitionedAccountEvents {
  events: ExternalEvent[]
  successCount: number
  authRejectedCount: number
}

// Splits a multi-account getEvents() result into merged events plus
// per-outcome counts, routing any error that isn't an expected
// auth-rejection to `onUnhandledError`. Shared by routes/calendar.ts and
// routes/schedules.ts so their fan-out/best-effort semantics can't drift
// apart the way they did before this was extracted (schedules.ts was
// capturing expected auth-rejected errors to Sentry on every request).
export function partitionAccountEvents(
  accounts: AccountEventsResult[],
  onUnhandledError: (accountId: string, error: AccountEventsError) => void,
): PartitionedAccountEvents {
  const events: ExternalEvent[] = []
  let successCount = 0
  let authRejectedCount = 0

  for (const { accountId, result } of accounts) {
    result.match(
      (accountEvents) => {
        successCount++
        events.push(...accountEvents)
      },
      (error) => {
        if (error instanceof TokenRefreshError && error.rejected) {
          authRejectedCount++
          return
        }
        onUnhandledError(accountId, error)
      },
    )
  }

  return { events, successCount, authRejectedCount }
}
