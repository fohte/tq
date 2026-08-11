import type { ReactNode } from 'react'

import { Button } from '#components/ui/button'
import { cn } from '#lib/utils'

export interface IntegrationAccountView {
  id: string
  label: string | null
}

export interface IntegrationCardProps {
  icon: ReactNode
  displayName: string
  accounts: IntegrationAccountView[]
  canConnect: boolean
  configured: boolean
  authUrl?: string
  onDisconnectAccount: (accountId: string) => void
  disconnectingAccountId?: string | null
  /** Provider-specific content rendered below an account row (e.g. Google Calendar's calendar picker). */
  renderAccountExtra?: (account: IntegrationAccountView) => ReactNode
}

// Shared between the header row and each account row below so the account
// label's start position tracks the header's name text automatically.
const CARD_INDENT = 'grid grid-cols-[1.25rem_1fr] items-center gap-3.5 pl-4'

export function IntegrationCard({
  icon,
  displayName,
  accounts,
  canConnect,
  configured,
  authUrl,
  onDisconnectAccount,
  disconnectingAccountId,
  renderAccountExtra,
}: IntegrationCardProps) {
  return (
    <div>
      <div className={cn(CARD_INDENT, 'py-4 pr-4')}>
        <div className="shrink-0">{icon}</div>
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="font-mono text-[13px] font-medium text-foreground">
              {displayName}
            </span>
            {accounts.length === 0 && (
              <span className="text-xs text-muted-foreground">
                {configured
                  ? `${displayName} が連携されていません`
                  : `${displayName} は未設定です (サーバー側の環境変数が不足しています)`}
              </span>
            )}
          </div>

          {canConnect && (
            <Button
              className="ml-auto shrink-0"
              size="sm"
              disabled={authUrl == null}
              render={
                authUrl != null ? (
                  <a href={authUrl} target="_blank" rel="noopener noreferrer" />
                ) : (
                  <button type="button" />
                )
              }
            >
              {accounts.length > 0 ? 'アカウントを追加' : '連携する'}
            </Button>
          )}
        </div>
      </div>

      {accounts.length > 0 && (
        <ul className="divide-y divide-border border-t border-border">
          {accounts.map((account) => (
            <li key={account.id} className={CARD_INDENT}>
              <div />
              <div className="min-w-0">
                <div className="flex min-w-0 items-center justify-between gap-4 py-2 pr-4">
                  <span className="min-w-0 truncate text-xs text-muted-foreground">
                    {account.label ?? '連携中'}
                  </span>
                  <Button
                    variant="destructive"
                    size="xs"
                    className="shrink-0"
                    onClick={() => {
                      onDisconnectAccount(account.id)
                    }}
                    disabled={disconnectingAccountId === account.id}
                  >
                    連携を解除
                  </Button>
                </div>
                {renderAccountExtra?.(account)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
