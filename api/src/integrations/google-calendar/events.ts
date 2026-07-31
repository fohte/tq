import { type Result, ResultAsync } from 'neverthrow'

import type { IntegrationConfigError } from '#integrations/errors'
import { TokenRefreshError } from '#integrations/errors'
import {
  type CalendarApiError,
  googleCalendarProvider,
} from '#integrations/google-calendar/provider'
import { listSubscribedCalendars } from '#integrations/google-calendar/subscriptions'
import { ensureValidAccessToken, listAccountTokens } from '#integrations/oauth'
import type { ExternalEvent } from '#integrations/types'

export type AccountEventsError =
  IntegrationConfigError | TokenRefreshError | CalendarApiError

export interface AccountEventsResult {
  accountId: string
  accountLabel: string | null
  result: Result<ExternalEvent[], AccountEventsError>
}

function getSubscribedCalendarEvents(
  accessToken: string,
  oauthTokenId: string,
  timeMin: string,
  timeMax: string,
): ResultAsync<
  Omit<ExternalEvent, 'accountId' | 'accountLabel'>[],
  AccountEventsError
> {
  return listSubscribedCalendars(oauthTokenId).andThen((subscriptions) =>
    ResultAsync.combine(
      subscriptions.map((subscription) =>
        googleCalendarProvider.capabilities.calendarEvents
          .getEvents(accessToken, {
            calendarId: subscription.calendarId,
            timeMin,
            timeMax,
          })
          .map((events) =>
            events.map((event) => ({
              ...event,
              calendarDisplayName: subscription.displayName,
              calendarColor: subscription.color,
            })),
          ),
      ),
    ).map((eventLists) => eventLists.flat()),
  )
}

// Resolves to a best-effort per-account result rather than a single Result,
// mirroring getIntegrationSummary in oauth.ts: one account's failure (e.g.
// a revoked refresh token) must not prevent the other connected accounts'
// events from being returned. Zero subscribed calendars for an account
// resolves to zero events for it, not its primary calendar — see the
// calendar_subscriptions comment in db/schema/integrations.ts.
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
          getSubscribedCalendarEvents(accessToken, token.id, timeMin, timeMax),
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
