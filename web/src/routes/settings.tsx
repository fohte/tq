import { createFileRoute } from '@tanstack/react-router'
import { Calendar, Puzzle } from 'lucide-react'
import type { ReactNode } from 'react'

import { IntegrationCard } from '#components/settings/integration-card'
import { GithubMarkIcon } from '#components/ui/github-mark-icon'
import {
  type IntegrationSummary,
  useDisconnectIntegrationAccount,
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
        ) : integrationsList.isSuccess ? (
          <div className="flex flex-col gap-3">
            {integrationsList.data.map((summary) => (
              <SettingsIntegrationRow key={summary.id} summary={summary} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-destructive">
            連携状態の取得に失敗しました
          </p>
        )}
      </div>
    </div>
  )
}

function SettingsIntegrationRow({ summary }: { summary: IntegrationSummary }) {
  const canConnect =
    summary.configured &&
    (summary.supportsMultipleAccounts || summary.accounts.length === 0)
  const authUrl = useIntegrationAuthUrl(summary.id, canConnect)
  const disconnectAccount = useDisconnectIntegrationAccount(summary.id)

  return (
    <IntegrationCard
      icon={
        INTEGRATION_ICONS[summary.id] ?? (
          <Puzzle className="size-6 text-foreground" />
        )
      }
      displayName={summary.displayName}
      accounts={summary.accounts}
      supportsMultipleAccounts={summary.supportsMultipleAccounts}
      configured={summary.configured}
      {...(authUrl.data?.url != null ? { authUrl: authUrl.data.url } : {})}
      onDisconnectAccount={(accountId) => {
        disconnectAccount.mutate(accountId)
      }}
      disconnectingAccountId={
        disconnectAccount.isPending ? disconnectAccount.variables : null
      }
    />
  )
}
