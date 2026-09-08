import { captureWithFingerprint } from '@fohte/service-kit/observability'
import { errAsync, okAsync, type Result, ResultAsync } from 'neverthrow'

import type { IntegrationConfigError } from '#integrations/errors'
import { TokenRefreshError } from '#integrations/errors'
import {
  type CalendarApiError,
  googleCalendarProvider,
} from '#integrations/google-calendar/provider'
import { listSubscribedCalendars } from '#integrations/google-calendar/subscriptions'
import { ensureValidAccessToken, listAccountTokens } from '#integrations/oauth'
import type { ExternalEvent } from '#integrations/types'

type AccountEventsError =
  IntegrationConfigError | TokenRefreshError | CalendarApiError

export interface AccountEventsResult {
  accountId: string
  accountLabel: string | null
  result: Result<ExternalEvent[], AccountEventsError>
}

type CalendarEvent = Omit<ExternalEvent, 'accountId' | 'accountLabel'>
type ProviderEvent = Omit<
  CalendarEvent,
  'calendarDisplayName' | 'calendarColor' | 'redacted'
>

// A subscription's own null context (see calendar_subscriptions in
// db/schema/integrations.ts) matches any requested context; undefined
// disables masking entirely.
function matchesRequestedContext(
  subscriptionContext: 'work' | 'personal' | null,
  requestedContext: 'work' | 'personal' | undefined,
): boolean {
  return (
    requestedContext == null ||
    subscriptionContext == null ||
    subscriptionContext === requestedContext
  )
}

// Strips a mismatched-context event down to only its busy time. An all-day
// event carries no busy time to begin with (externalEventsToBusyRanges in
// services/auto-scheduler.ts excludes them), so callers filter those out
// before this ever masks one.
function maskEvent(event: ProviderEvent): CalendarEvent {
  return {
    id: event.id,
    startTime: event.startTime,
    endTime: event.endTime,
    isAllDay: event.isAllDay,
    source: event.source,
    calendarId: event.calendarId,
    responseStatus: event.responseStatus,
    // Both describe what the event is, not when it is busy, so they are
    // dropped to their neutral values like the summary.
    eventType: 'default',
    hasOtherAttendees: false,
    summary: '',
    calendarDisplayName: null,
    calendarColor: null,
    redacted: true,
  }
}

// Fetches every subscribed calendar's events best-effort, mirroring
// partitionAccountEvents one level down: one subscribed calendar failing
// (e.g. access to a shared calendar was revoked) must not hide the other
// subscribed calendars' events for the same account. ResultAsync.combine
// can't be used here since it short-circuits on the first Err, discarding
// any calendar that already resolved Ok. Only propagates an Err when every
// subscribed calendar failed, so the account-level success/failure signal
// partitionAccountEvents relies on is unchanged.
function getSubscribedCalendarEvents(
  accessToken: string,
  oauthTokenId: string,
  timeMin: string,
  timeMax: string,
  context: 'work' | 'personal' | undefined,
): ResultAsync<
  Omit<ExternalEvent, 'accountId' | 'accountLabel'>[],
  AccountEventsError
> {
  return listSubscribedCalendars(oauthTokenId).andThen((subscriptions) => {
    return ResultAsync.fromSafePromise(
      Promise.all(
        subscriptions.map((subscription) => {
          // A timed event on a calendar whose context doesn't match the
          // requested one is still fetched, since its busy time is real
          // regardless of context, and its content is masked below instead
          // of being excluded outright. An all-day event has no busy time to
          // preserve this way, so it's excluded like before this masking
          // behavior existed.
          const matchesContext = matchesRequestedContext(
            subscription.context,
            context,
          )

          return googleCalendarProvider.capabilities.calendarEvents
            .getEvents(accessToken, {
              calendarId: subscription.calendarId,
              timeMin,
              timeMax,
            })
            .map((events) =>
              events
                .filter((event) => event.responseStatus !== 'declined')
                .filter((event) => matchesContext || !event.isAllDay)
                .map((event) =>
                  matchesContext
                    ? {
                        ...event,
                        calendarDisplayName: subscription.displayName,
                        calendarColor: subscription.color,
                        redacted: false,
                      }
                    : maskEvent(event),
                ),
            )
        }),
      ),
    ).andThen((results) => {
      const events: Omit<ExternalEvent, 'accountId' | 'accountLabel'>[] = []
      let successCount = 0
      let firstError: AccountEventsError | undefined

      for (const result of results) {
        result.match(
          (calendarEvents) => {
            successCount++
            events.push(...calendarEvents)
          },
          (error) => {
            firstError ??= error
            captureWithFingerprint(
              error,
              'api.calendar.get-events-calendar-failed',
              { extras: { oauthTokenId } },
            )
          },
        )
      }

      if (
        subscriptions.length > 0 &&
        successCount === 0 &&
        firstError != null
      ) {
        return errAsync(firstError)
      }
      return okAsync(events)
    })
  })
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
  context?: 'work' | 'personal',
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
          getSubscribedCalendarEvents(
            accessToken,
            token.id,
            timeMin,
            timeMax,
            context,
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

interface PartitionedAccountEvents {
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
