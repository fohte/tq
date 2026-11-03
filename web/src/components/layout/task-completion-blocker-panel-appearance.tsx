import { Button } from '@fohte/ui/button'
import { Link } from '@tanstack/react-router'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '#lib/utils'

export interface TaskCompletionPanelWait {
  id: string
  label: string
  resolved: boolean
}

export interface TaskCompletionPanelGithubBlocker {
  key: string
  label: string
  url: string
  resolved: boolean
}

export interface TaskCompletionPanelTaskBlocker {
  number: number
  resolved: boolean
}

function BlockerRow({
  kind,
  label,
  resolved,
  mono = false,
  action,
}: {
  kind: 'WAIT' | 'TASK' | 'GITHUB'
  label: string
  resolved: boolean
  mono?: boolean
  action: ReactNode
}) {
  return (
    <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-xs">
      <span className="w-14 shrink-0 font-mono text-2xs text-muted-foreground">
        {kind}
      </span>
      <span
        className={cn(
          'min-w-0 flex-1 truncate',
          mono && 'font-mono',
          resolved && 'text-muted-foreground line-through',
        )}
      >
        {label}
      </span>
      {resolved ? (
        <span className="text-muted-foreground">✓ resolved</span>
      ) : (
        action
      )}
    </div>
  )
}

export function TaskCompletionBlockerPanelAppearance({
  taskNumber,
  waits = [],
  taskBlockers = [],
  githubBlockers = [],
  message,
  isRetryPending = false,
  resolvingWaitId,
  onResolveWait,
  onComplete,
  onClose,
}: {
  taskNumber?: number
  waits?: TaskCompletionPanelWait[]
  taskBlockers?: TaskCompletionPanelTaskBlocker[]
  githubBlockers?: TaskCompletionPanelGithubBlocker[]
  message?: string
  isRetryPending?: boolean
  resolvingWaitId?: string | null
  onResolveWait?: (waitId: string) => void
  onComplete?: () => void
  onClose: () => void
}) {
  const blockers = [...waits, ...taskBlockers, ...githubBlockers]
  const unresolvedCount = blockers.filter((blocker) => !blocker.resolved).length
  const hasBlockers = blockers.length > 0

  return (
    <section
      role="alert"
      aria-label={
        taskNumber == null
          ? "Couldn't complete task"
          : `Couldn't complete #${String(taskNumber)}`
      }
      className="fixed inset-x-0 bottom-0 z-50 max-h-dvh overflow-y-auto border border-l-3 border-border-strong border-l-destructive bg-card text-foreground shadow-lg sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-full sm:max-w-md"
    >
      <div className="flex items-start gap-2 px-4 pt-3 pb-2 pl-5">
        <span
          aria-hidden="true"
          className="mt-px flex size-3.5 shrink-0 items-center justify-center rounded-full border border-destructive font-mono text-2xs leading-none text-destructive"
        >
          !
        </span>
        <h2 className="min-w-0 flex-1 font-mono text-xs font-semibold">
          Couldn't complete
          {taskNumber == null ? ' task' : ` #${String(taskNumber)}`}
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Dismiss completion error"
          onClick={onClose}
          className="-mt-1 -mr-1"
        >
          <X aria-hidden="true" className="size-3.5" />
        </Button>
      </div>

      <div className="pl-5">
        {hasBlockers ? (
          <>
            <p className="px-4 pb-2 text-xs text-muted-foreground">
              {`Blocked by ${String(unresolvedCount)} unresolved ${unresolvedCount === 1 ? 'item' : 'items'}.`}
            </p>
            <div className="border-t border-border">
              {waits.map((wait) => (
                <BlockerRow
                  key={`wait-${wait.id}`}
                  kind="WAIT"
                  label={wait.label}
                  resolved={wait.resolved}
                  action={
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={resolvingWaitId === wait.id}
                      onClick={() => onResolveWait?.(wait.id)}
                    >
                      Resolve
                    </Button>
                  }
                />
              ))}
              {taskBlockers.map((task) => (
                <BlockerRow
                  key={`task-${String(task.number)}`}
                  kind="TASK"
                  label={`#${String(task.number)}`}
                  resolved={task.resolved}
                  mono
                  action={
                    <Link
                      to="/tasks/$taskId"
                      params={{ taskId: String(task.number) }}
                      className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    >
                      Open
                    </Link>
                  }
                />
              ))}
              {githubBlockers.map((github) => (
                <BlockerRow
                  key={github.key}
                  kind="GITHUB"
                  label={github.label}
                  resolved={github.resolved}
                  mono
                  action={
                    <a
                      href={github.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    >
                      Open ↗
                    </a>
                  }
                />
              ))}
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3 text-xs">
              <p className="text-muted-foreground">
                {unresolvedCount === 0
                  ? 'All items resolved.'
                  : 'Resolve every item to complete.'}
              </p>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={unresolvedCount > 0 || isRetryPending}
                onClick={onComplete}
              >
                Complete
              </Button>
            </div>
          </>
        ) : (
          <div className="px-4 pb-3 text-xs text-muted-foreground">
            <p>{message}</p>
            <p className="mt-1">The status was changed back to todo.</p>
          </div>
        )}
      </div>
    </section>
  )
}
