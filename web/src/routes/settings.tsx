import { createFileRoute } from '@tanstack/react-router'
import { Calendar, Puzzle } from 'lucide-react'
import type { ReactNode } from 'react'

import { GcalCalendarPicker } from '#components/settings/gcal-calendar-picker'
import { GithubSyncRuleList } from '#components/settings/github-sync-rule-list'
import { IntegrationCard } from '#components/settings/integration-card'
import { KeybindingsList } from '#components/settings/keybindings-list'
import { QueryStateMessage } from '#components/settings/query-state-message'
import { SchedulingSettingsPanel } from '#components/settings/scheduling-settings-panel'
import { SessionOpenSettingsPanel } from '#components/settings/session-open-settings-panel'
import { GithubMarkIcon } from '#components/ui/github-mark-icon'
import { Panel } from '#components/ui/panel'
import { ScreenHeaderBar } from '#components/ui/screen-header-bar'
import { SectionHeading } from '#components/ui/section-heading'
import { SlackMarkIcon } from '#components/ui/slack-mark-icon'
import {
  canConnectIntegration,
  type IntegrationSummary,
  useDisconnectIntegrationAccount,
  useIntegrationAuthUrl,
  useIntegrationsList,
} from '#hooks/use-integrations'

export const Route = createFileRoute('/settings')({
  component: Settings,
})

const INTEGRATION_ICONS: Record<string, ReactNode> = {
  github: <GithubMarkIcon className="size-5 text-foreground" />,
  google_calendar: <Calendar className="size-5 text-foreground" />,
  slack: <SlackMarkIcon className="size-5 text-foreground" />,
}

function Settings() {
  const integrationsList = useIntegrationsList()

  return (
    <div className="flex h-full flex-col">
      <ScreenHeaderBar>
        <SectionHeading level={2}>settings</SectionHeading>
      </ScreenHeaderBar>

      <div className="flex-1 overflow-y-auto p-4 md:px-7 md:py-6">
        <div className="flex max-w-3xl flex-col gap-2.5">
          <SectionHeading level={3}>integrations</SectionHeading>

          {integrationsList.isLoading ? (
            <QueryStateMessage status="loading" />
          ) : integrationsList.isSuccess ? (
            <Panel>
              <div className="divide-y divide-border">
                {integrationsList.data.map((summary) => (
                  <SettingsIntegrationRow key={summary.id} summary={summary} />
                ))}
              </div>
            </Panel>
          ) : (
            <QueryStateMessage
              status="error"
              message="連携状態の取得に失敗しました"
            />
          )}

          <div className="mt-8">
            <SchedulingSettingsPanel />
          </div>

          <div className="mt-8">
            <SessionOpenSettingsPanel />
          </div>

          <div className="mt-8">
            <GithubSyncRuleList />
          </div>

          <div className="mt-8">
            <KeybindingsList />
          </div>
        </div>
      </div>
    </div>
  )
}

function SettingsIntegrationRow({ summary }: { summary: IntegrationSummary }) {
  const canConnect = canConnectIntegration(summary)
  const authUrl = useIntegrationAuthUrl(summary.id, canConnect)
  const disconnectAccount = useDisconnectIntegrationAccount(summary.id)

  return (
    <IntegrationCard
      icon={
        INTEGRATION_ICONS[summary.id] ?? (
          <Puzzle className="size-5 text-foreground" />
        )
      }
      displayName={summary.displayName}
      accounts={summary.accounts}
      canConnect={canConnect}
      configured={summary.configured}
      {...(authUrl.data?.url != null ? { authUrl: authUrl.data.url } : {})}
      onDisconnectAccount={(accountId) => {
        disconnectAccount.mutate(accountId)
      }}
      disconnectingAccountId={
        disconnectAccount.isPending ? disconnectAccount.variables : null
      }
      {...(summary.id === 'google_calendar'
        ? {
            renderAccountExtra: (account) => (
              <GcalCalendarPicker account={account} />
            ),
          }
        : {})}
    />
  )
}
