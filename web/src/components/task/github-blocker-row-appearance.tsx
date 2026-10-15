import { Button } from '@fohte/ui/button'
import { X } from 'lucide-react'

import { GitHubNotifyEventsPicker } from '#components/task/github-notify-events-picker'
import { GithubRefSummary } from '#components/task/github-ref-summary'
import type { GithubBlocker } from '#hooks/use-github-link'

export type GithubBlockerWaitMode = 'until-closed' | 'until-reply'

export function GithubBlockerRowAppearance({
  blocker,
  waitMode,
  waitModeDisabled = false,
  notifyEventsDisabled = false,
  removeDisabled = false,
  onWaitModeChange,
  onNotifyEventsChange,
  onRemove,
}: {
  blocker: GithubBlocker
  waitMode: GithubBlockerWaitMode
  waitModeDisabled?: boolean
  notifyEventsDisabled?: boolean
  removeDisabled?: boolean
  onWaitModeChange: (mode: GithubBlockerWaitMode) => void
  onNotifyEventsChange: (notifyEvents: GithubBlocker['notifyEvents']) => void
  onRemove: () => void
}) {
  const ref = `${blocker.owner}/${blocker.repo}#${String(blocker.number)}`

  return (
    <div className="flex items-center gap-2 border-b border-border px-3 py-2 last:border-b-0">
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
      <select
        aria-label={`Wait mode for ${ref}`}
        value={waitMode}
        disabled={waitModeDisabled}
        onChange={(event) => {
          onWaitModeChange(
            event.target.value === 'until-reply'
              ? 'until-reply'
              : 'until-closed',
          )
        }}
        className="h-7 w-32 shrink-0 border-0 bg-transparent p-0 font-mono text-xs text-muted-foreground underline decoration-border-strong underline-offset-2 focus-visible:ring-0"
      >
        <option value="until-closed">until closed</option>
        <option
          value="until-reply"
          disabled={blocker.state !== 'open' && waitMode !== 'until-reply'}
        >
          until reply
        </option>
      </select>
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
  )
}
