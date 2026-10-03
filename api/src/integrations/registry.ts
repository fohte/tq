import { githubProvider } from '#integrations/github/index'
import { googleCalendarProvider } from '#integrations/google-calendar/index'
import type { IntegrationProvider } from '#integrations/types'

export const integrationProviders: IntegrationProvider[] = [
  githubProvider,
  googleCalendarProvider,
]

export function findIntegrationProvider(
  id: string,
): IntegrationProvider | undefined {
  return integrationProviders.find((provider) => provider.id === id)
}
