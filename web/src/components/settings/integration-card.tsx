import type { ReactNode } from 'react'

import { Button } from '#components/ui/button'

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
}

export function IntegrationCard({
  icon,
  displayName,
  accounts,
  canConnect,
  configured,
  authUrl,
  onDisconnectAccount,
  disconnectingAccountId,
}: IntegrationCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {icon}
          <span className="text-sm font-medium text-foreground">
            {displayName}
          </span>
        </div>

        {canConnect && (
          <Button
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

      {accounts.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {accounts.map((account) => (
            <li
              key={account.id}
              className="flex items-center justify-between gap-4"
            >
              <span className="text-sm text-muted-foreground">
                {account.label ?? '連携中'}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onDisconnectAccount(account.id)
                }}
                disabled={disconnectingAccountId === account.id}
              >
                連携を解除
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <span className="text-sm text-muted-foreground">
          {configured
            ? `${displayName} が連携されていません`
            : `${displayName} は未設定です (サーバー側の環境変数が不足しています)`}
        </span>
      )}
    </div>
  )
}
