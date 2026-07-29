import { Button } from '#components/ui/button'
import { GithubMarkIcon } from '#components/ui/github-mark-icon'

export interface GithubConnectionCardProps {
  isLoading: boolean
  connected: boolean
  login?: string
  authUrl?: string
  onDisconnect: () => void
  isDisconnecting?: boolean
}

export function GithubConnectionCard({
  isLoading,
  connected,
  login,
  authUrl,
  onDisconnect,
  isDisconnecting,
}: GithubConnectionCardProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
      <div className="flex items-center gap-3">
        <GithubMarkIcon className="size-6 text-foreground" />
        <div className="flex flex-col">
          <span className="text-sm font-medium text-foreground">GitHub</span>
          <span className="text-sm text-muted-foreground">
            {isLoading
              ? 'Loading...'
              : connected
                ? `@${login ?? ''} として連携中`
                : 'GitHub が連携されていません'}
          </span>
        </div>
      </div>

      {!isLoading &&
        (connected ? (
          <Button
            variant="outline"
            onClick={onDisconnect}
            disabled={isDisconnecting}
          >
            連携を解除
          </Button>
        ) : (
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
        ))}
    </div>
  )
}
