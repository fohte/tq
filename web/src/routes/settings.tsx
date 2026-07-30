import { createFileRoute } from '@tanstack/react-router'
import { Calendar, Puzzle } from 'lucide-react'
import type { ReactNode } from 'react'

import { IntegrationCard } from '#components/settings/integration-card'
import { GithubMarkIcon } from '#components/ui/github-mark-icon'
import {
  type IntegrationSummary,
  useDisconnectIntegration,
  useIntegrationAuthUrl,
  useIntegrationsList,
} from '#hooks/use-integrations'

export const Route = createFileRoute('/settings')({
  component: Settings,
})

const INTEGRATION_ICONS: Record<string, ReactNode> = {
  github: <GithubMarkIcon className="size-6 text-foreground" />,
  google_calendar: <Calendar className="size-6 text-foreground" />,
}

function Settings() {
  const integrationsList = useIntegrationsList()

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <h1 className="text-lg font-bold text-foreground">Settings</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {integrationsList.isLoading ? (
          <p className="text-sm text-muted-foreground">読み込み中...</p>
        ) : (
          <div className="flex flex-col gap-3">
            {(integrationsList.data ?? []).map((summary) => (
              <SettingsIntegrationRow key={summary.id} summary={summary} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SettingsIntegrationRow({ summary }: { summary: IntegrationSummary }) {
  const authUrl = useIntegrationAuthUrl(
    summary.id,
    !summary.connected && summary.configured,
  )
  const disconnect = useDisconnectIntegration(summary.id)

  return (
    <IntegrationCard
      icon={
        INTEGRATION_ICONS[summary.id] ?? (
          <Puzzle className="size-6 text-foreground" />
        )
      }
      displayName={summary.displayName}
      connected={summary.connected}
      configured={summary.configured}
      {...(summary.connected && summary.login != null
        ? { login: summary.login }
        : {})}
      {...(authUrl.data?.url != null ? { authUrl: authUrl.data.url } : {})}
      onDisconnect={() => {
        disconnect.mutate()
      }}
      isDisconnecting={disconnect.isPending}
    />
  )
}
