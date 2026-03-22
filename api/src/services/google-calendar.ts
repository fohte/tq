import { db } from '@api/db/connection'
import { oauthTokens } from '@api/db/schema'
import { eq } from 'drizzle-orm'

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const GOOGLE_CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3'
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly'
const PROVIDER = 'google_calendar'

// Token refresh buffer: refresh 5 minutes before expiry
const REFRESH_BUFFER_MS = 5 * 60 * 1000

function getConfig() {
  const clientId = process.env['GOOGLE_CLIENT_ID']
  const clientSecret = process.env['GOOGLE_CLIENT_SECRET']
  const redirectUri = process.env['GOOGLE_REDIRECT_URI']

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI environment variables are required',
    )
  }

  return { clientId, clientSecret, redirectUri }
}

export function getAuthUrl(): string {
  const { clientId, redirectUri } = getConfig()

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
  })

  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`
}

export async function handleOAuthCallback(code: string): Promise<void> {
  const { clientId, clientSecret, redirectUri } = getConfig()

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token exchange failed: ${error}`)
  }

  const data = (await response.json()) as {
    access_token: string
    refresh_token: string
    expires_in: number
  }

  const expiresAt = new Date(Date.now() + data.expires_in * 1000)

  // Upsert: delete existing token for this provider, then insert new one
  await db.delete(oauthTokens).where(eq(oauthTokens.provider, PROVIDER))
  await db.insert(oauthTokens).values({
    provider: PROVIDER,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
  })
}

export async function refreshTokenIfNeeded(): Promise<string> {
  const [token] = await db
    .select()
    .from(oauthTokens)
    .where(eq(oauthTokens.provider, PROVIDER))
    .limit(1)

  if (!token) {
    throw new Error('No OAuth token found. Please authenticate first.')
  }

  // Return existing token if not expired
  if (token.expiresAt.getTime() > Date.now() + REFRESH_BUFFER_MS) {
    return token.accessToken
  }

  // Refresh the token
  const { clientId, clientSecret } = getConfig()

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: token.refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token refresh failed: ${error}`)
  }

  const data = (await response.json()) as {
    access_token: string
    expires_in: number
  }

  const expiresAt = new Date(Date.now() + data.expires_in * 1000)

  await db
    .update(oauthTokens)
    .set({
      accessToken: data.access_token,
      expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(oauthTokens.id, token.id))

  return data.access_token
}

export interface ExternalEvent {
  id: string
  summary: string
  startTime: string
  endTime: string
  isAllDay: boolean
  source: 'google_calendar'
}

interface GoogleCalendarEvent {
  id: string
  summary?: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
}

interface GoogleCalendarEventsResponse {
  items?: GoogleCalendarEvent[]
}

export async function getEvents(
  calendarId: string,
  timeMin: string,
  timeMax: string,
): Promise<ExternalEvent[]> {
  const accessToken = await refreshTokenIfNeeded()

  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
  })

  const response = await fetch(
    `${GOOGLE_CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Google Calendar API error: ${error}`)
  }

  const data = (await response.json()) as GoogleCalendarEventsResponse

  return (data.items ?? []).map((event) => {
    const isAllDay = !event.start.dateTime
    return {
      id: event.id,
      summary: event.summary ?? '(No title)',
      startTime: event.start.dateTime ?? event.start.date ?? '',
      endTime: event.end.dateTime ?? event.end.date ?? '',
      isAllDay,
      source: 'google_calendar' as const,
    }
  })
}
