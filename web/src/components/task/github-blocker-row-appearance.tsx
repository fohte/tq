import { Button } from '@fohte/ui/button'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'

import { GitHubNotifyEventsPicker } from '#components/task/github-notify-events-picker'
import { GithubRefSummary } from '#components/task/github-ref-summary'
import type { GithubBlocker } from '#hooks/use-github-link'
import { cn } from '#lib/utils'

export function GithubBlockerRowAppearance({
  blocker,
  waitModeControl,
  notifyEventsDisabled = false,
  removeDisabled = false,
  onNotifyEventsChange,
  onRemove,
  children,
  needsAcknowledgement = false,
  resolved = false,
}: {
  blocker: GithubBlocker
  waitModeControl?: ReactNode
  notifyEventsDisabled?: boolean
  removeDisabled?: boolean
  onNotifyEventsChange: (notifyEvents: GithubBlocker['notifyEvents']) => void
  onRemove: () => void
  children?: ReactNode
  needsAcknowledgement?: boolean
  resolved?: boolean
}) {
  const ref = `${blocker.owner}/${blocker.repo}#${String(blocker.number)}`

  return (
    <div
      role="group"
      aria-label={`GitHub blocker ${ref}`}
      className={cn(
        'flex flex-col gap-1 border-b border-border px-3 py-2 last:border-b-0',
        needsAcknowledgement && 'text-primary',
        resolved && !needsAcknowledgement && 'opacity-55',
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-muted-foreground">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <a
            href={blocker.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-w-0 items-center gap-2 text-sm hover:underline"
            title={ref}
          >
            <GithubRefSummary
              kind={blocker.kind}
              state={blocker.state}
              owner={blocker.owner}
              repo={blocker.repo}
              number={blocker.number}
              title={blocker.title}
              refClassName="min-w-0 shrink truncate"
              titleClassName={
                blocker.state === 'open'
                  ? 'min-w-0 flex-1'
                  : 'min-w-0 flex-1 text-muted-foreground'
              }
            />
          </a>
          <span className="font-mono text-2xs text-muted-foreground-faint">
            github · {blocker.state}
          </span>
        </div>
        <GitHubNotifyEventsPicker
          value={blocker.notifyEvents}
          onChange={onNotifyEventsChange}
          disabled={notifyEventsDisabled}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={onRemove}
          disabled={removeDisabled}
          aria-label={`Remove ${ref} as blocker`}
          className="shrink-0 text-muted-foreground-faint hover:text-destructive"
        >
          <X className="size-3.5" />
        </Button>
      </div>
      {waitModeControl}
      {children}
    </div>
  )
}
