import { githubProvider } from '#integrations/github/index'
import { googleCalendarProvider } from '#integrations/google-calendar/index'
import type { IntegrationProvider } from '#integrations/types'

export const INTEGRATION_PROVIDER_IDS = ['google_calendar', 'github'] as const

export type IntegrationProviderId = (typeof INTEGRATION_PROVIDER_IDS)[number]

export const integrationProviders: Record<
  IntegrationProviderId,
  IntegrationProvider
> = {
  google_calendar: googleCalendarProvider,
  github: githubProvider,
}
