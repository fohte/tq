import { db } from '@api/db/connection'
import { oauthTokens } from '@api/db/schema'
import { eq } from 'drizzle-orm'
import {
  err,
  errAsync,
  ok,
  okAsync,
  type Result,
  ResultAsync,
} from 'neverthrow'
import { z } from 'zod'

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const GOOGLE_CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3'
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly'
const PROVIDER = 'google_calendar'

// Token refresh buffer: refresh 5 minutes before expiry
const REFRESH_BUFFER_MS = 5 * 60 * 1000

export class OAuthTokenMissingError extends Error {
  constructor() {
    super('No OAuth token found. Please authenticate first.')
    this.name = 'OAuthTokenMissingError'
  }
}

export class GoogleCalendarConfigError extends Error {
  constructor() {
    super(
      'GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI environment variables are required',
    )
    this.name = 'GoogleCalendarConfigError'
  }
}

export class TokenExchangeError extends Error {
  constructor(message: string) {
    super(`Token exchange failed: ${message}`)
    this.name = 'TokenExchangeError'
  }
}

export class TokenRefreshError extends Error {
  constructor(message: string) {
    super(`Token refresh failed: ${message}`)
    this.name = 'TokenRefreshError'
  }
}

export class CalendarApiError extends Error {
  constructor(message: string) {
    super(`Google Calendar API error: ${message}`)
    this.name = 'CalendarApiError'
  }
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
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

interface GoogleCalendarConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}

function getConfig(): Result<GoogleCalendarConfig, GoogleCalendarConfigError> {
  const clientId = process.env['GOOGLE_CLIENT_ID']
  const clientSecret = process.env['GOOGLE_CLIENT_SECRET']
  const redirectUri = process.env['GOOGLE_REDIRECT_URI']

  if (
    clientId == null ||
    clientId === '' ||
    clientSecret == null ||
    clientSecret === '' ||
    redirectUri == null ||
    redirectUri === ''
  ) {
    return err(new GoogleCalendarConfigError())
  }

  return ok({ clientId, clientSecret, redirectUri })
}

export function getAuthUrl(): Result<string, GoogleCalendarConfigError> {
  return getConfig().map(({ clientId, redirectUri }) => {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES,
      access_type: 'offline',
      prompt: 'consent',
    })

    return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`
  })
}

/**
 * Fetch `input` and parse the JSON response against `schema`, wrapping any
 * fetch failure, non-2xx response, or schema mismatch with `wrapError`.
 */
function fetchJson<T, E extends Error>(
  input: string,
  init: RequestInit,
  schema: z.ZodType<T>,
  wrapError: (message: string) => E,
): ResultAsync<T, E> {
  return ResultAsync.fromPromise(fetch(input, init), (cause) =>
    wrapError(errorMessage(cause)),
  ).andThen((res) => {
    if (!res.ok) {
      return ResultAsync.fromPromise(res.text(), (cause) =>
        wrapError(errorMessage(cause)),
      ).andThen((text) => errAsync(wrapError(text)))
    }
    return ResultAsync.fromPromise(res.json(), (cause) =>
      wrapError(errorMessage(cause)),
    ).andThen((data) => {
      const parsed = schema.safeParse(data)
      return parsed.success
        ? okAsync(parsed.data)
        : errAsync(wrapError(parsed.error.message))
    })
  })
}

export function handleOAuthCallback(
  code: string,
): ResultAsync<void, GoogleCalendarConfigError | TokenExchangeError> {
  return getConfig()
    .asyncAndThen(({ clientId, clientSecret, redirectUri }) =>
      fetchJson(
        GOOGLE_TOKEN_ENDPOINT,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
          }),
        },
        tokenResponseSchema,
        (message) => new TokenExchangeError(message),
      ),
    )
    .andThen((data) => {
      const expiresAt = new Date(Date.now() + data.expires_in * 1000)
      return ResultAsync.fromSafePromise(
        db
          .insert(oauthTokens)
          .values({
            provider: PROVIDER,
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt,
          })
          .onConflictDoUpdate({
            target: oauthTokens.provider,
            set: {
              accessToken: data.access_token,
              refreshToken: data.refresh_token,
              expiresAt,
              updatedAt: new Date(),
            },
          }),
      ).map(() => undefined)
    })
}

export function refreshTokenIfNeeded(): ResultAsync<
  string,
  OAuthTokenMissingError | GoogleCalendarConfigError | TokenRefreshError
> {
  return ResultAsync.fromSafePromise(
    db
      .select()
      .from(oauthTokens)
      .where(eq(oauthTokens.provider, PROVIDER))
      .limit(1),
  ).andThen(([token]) => {
    if (!token) {
      return errAsync(new OAuthTokenMissingError())
    }

    // Return existing token if not expired
    if (token.expiresAt.getTime() > Date.now() + REFRESH_BUFFER_MS) {
      return okAsync(token.accessToken)
    }

    return getConfig()
      .asyncAndThen(({ clientId, clientSecret }) =>
        fetchJson(
          GOOGLE_TOKEN_ENDPOINT,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: clientId,
              client_secret: clientSecret,
              refresh_token: token.refreshToken,
              grant_type: 'refresh_token',
            }),
          },
          refreshTokenResponseSchema,
          (message) => new TokenRefreshError(message),
        ),
      )
      .andThen((data) => {
        const expiresAt = new Date(Date.now() + data.expires_in * 1000)
        return ResultAsync.fromSafePromise(
          db
            .update(oauthTokens)
            .set({
              accessToken: data.access_token,
              expiresAt,
              updatedAt: new Date(),
              ...(data.refresh_token != null && data.refresh_token !== ''
                ? { refreshToken: data.refresh_token }
                : {}),
            })
            .where(eq(oauthTokens.id, token.id)),
        ).map(() => data.access_token)
      })
  })
}

export interface ExternalEvent {
  id: string
  summary: string
  startTime: string
  endTime: string
  isAllDay: boolean
  source: 'google_calendar'
}

export function getEvents(
  calendarId: string,
  timeMin: string,
  timeMax: string,
): ResultAsync<
  ExternalEvent[],
  | OAuthTokenMissingError
  | GoogleCalendarConfigError
  | TokenRefreshError
  | CalendarApiError
> {
  return refreshTokenIfNeeded()
    .andThen((accessToken) => {
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
        (message) => new CalendarApiError(message),
      )
    })
    .map((data) =>
      (data.items ?? []).map((event) => {
        const isAllDay = event.start.dateTime == null
        return {
          id: event.id,
          summary: event.summary ?? '(No title)',
          startTime: event.start.dateTime ?? event.start.date ?? '',
          endTime: event.end.dateTime ?? event.end.date ?? '',
          isAllDay,
          source: 'google_calendar' as const,
        }
      }),
    )
}
