import type { ReactNode } from 'react'

import { Button } from '#components/ui/button'

export interface IntegrationCardProps {
  icon: ReactNode
  displayName: string
  connected: boolean
  login?: string
  configured: boolean
  authUrl?: string
  onDisconnect: () => void
  isDisconnecting?: boolean
}

export function IntegrationCard({
  icon,
  displayName,
  connected,
  login,
  configured,
  authUrl,
  onDisconnect,
  isDisconnecting,
}: IntegrationCardProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
      <div className="flex items-center gap-3">
        {icon}
        <div className="flex flex-col">
          <span className="text-sm font-medium text-foreground">
            {displayName}
          </span>
          <span className="text-sm text-muted-foreground">
            {connected
              ? login != null
                ? `@${login} として連携中`
                : '連携中'
              : configured
                ? `${displayName} が連携されていません`
                : `${displayName} は未設定です (サーバー側の環境変数が不足しています)`}
          </span>
        </div>
      </div>

      {connected ? (
        <Button
          variant="outline"
          onClick={onDisconnect}
          disabled={isDisconnecting}
        >
          連携を解除
        </Button>
      ) : (
        configured && (
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
            連携する
          </Button>
        )
      )}
    </div>
  )
}
