import { githubProvider } from '#integrations/github/index'
import { googleCalendarProvider } from '#integrations/google-calendar/index'
import { slackProvider } from '#integrations/slack/index'
import type { IntegrationProvider } from '#integrations/types'

export const integrationProviders: IntegrationProvider[] = [
  githubProvider,
  googleCalendarProvider,
  slackProvider,
]

export function findIntegrationProvider(
  id: string,
): IntegrationProvider | undefined {
  return integrationProviders.find((provider) => provider.id === id)
}
