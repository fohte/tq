import { Button } from '@web/components/ui/button'

// lucide-react's `Github` brand icon is deprecated
// (https://github.com/lucide-icons/lucide/issues/670), so the mark is
// inlined here instead.
function GithubMarkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  )
}

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
