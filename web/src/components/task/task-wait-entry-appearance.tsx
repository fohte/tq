import { Button } from '@fohte/ui/button'
import { Input } from '@fohte/ui/input'
import { Check, Hourglass, X } from 'lucide-react'
import type { FocusEvent, ReactNode } from 'react'

import { EditableMarkdownDescription } from '#components/ui/editable-markdown-description'
import type { TaskWait } from '#hooks/use-tasks'
import { formatLocalDate } from '#lib/date-range'
import { formatShortDate } from '#lib/task-due-date'
import { needsWaitAcknowledgement } from '#lib/task-waits'
import { cn } from '#lib/utils'

export function TaskWaitEntryAppearance({
  wait,
  layout = 'standalone',
  waitModeControl,
  followUpDate,
  disabled,
  errors,
  onFollowUpDateChange,
  onFollowUpDateBlur,
  onResolve,
  onAcknowledge,
  onRemove,
  onBodyChange,
  onExitEditMode,
}: {
  wait: TaskWait
  layout?: 'standalone' | 'github-blocker'
  waitModeControl?: ReactNode
  followUpDate: string
  disabled: boolean
  errors?: ReactNode
  onFollowUpDateChange: (date: string) => void
  onFollowUpDateBlur: (event: FocusEvent<HTMLInputElement>) => void
  onResolve: () => void
  onAcknowledge: () => void
  onRemove: () => void
  onBodyChange: (body: string) => void
  onExitEditMode: () => void
}) {
  const isResolved = wait.resolvedAt != null
  const needsAcknowledgement = needsWaitAcknowledgement(wait)
  const header = (
    <>
      {layout === 'standalone' && (
        <Hourglass className="size-3.5 shrink-0" aria-hidden="true" />
      )}
      {layout === 'standalone' && (
        <span>
          {needsAcknowledgement
            ? 'wait resolved'
            : isResolved
              ? 'resolved'
              : 'waiting'}
        </span>
      )}
      {layout === 'github-blocker' && needsAcknowledgement && (
        <span className="font-mono text-xs text-primary">wait resolved</span>
      )}
      {waitModeControl}
      {wait.resolvedAt != null ? (
        <span className="ml-auto text-muted-foreground-faint">
          resolved {formatShortDate(formatLocalDate(new Date(wait.resolvedAt)))}
        </span>
      ) : (
        <label className="ml-auto inline-flex min-w-0 max-w-full flex-wrap items-center justify-end gap-1.5 text-muted-foreground-faint">
          follow up
          <Input
            aria-label={`Follow-up date for ${wait.label}`}
            type="date"
            variant="ghost"
            required
            value={followUpDate}
            disabled={disabled}
            onBlur={onFollowUpDateBlur}
            onChange={(event) => {
              const nextFollowUpDate = event.target.value
              if (nextFollowUpDate !== '') {
                onFollowUpDateChange(nextFollowUpDate)
              }
            }}
            className="h-7 w-32 mx-0"
          />
        </label>
      )}
      {!isResolved && (
        <Button
          type="button"
          variant="plain"
          disabled={disabled}
          data-wait-action="resolve"
          onClick={onResolve}
          aria-label={`Resolve wait: ${wait.label}`}
          className="shrink-0"
        >
          <span className="flex items-center gap-1">
            <Check className="size-3.5" aria-hidden="true" />
            resolve
          </span>
        </Button>
      )}
      {needsAcknowledgement && (
        <Button
          type="button"
          variant="plain"
          disabled={disabled}
          data-wait-action="acknowledge"
          onClick={onAcknowledge}
          aria-label={`Acknowledge wait: ${wait.label}`}
          className="shrink-0 text-primary"
        >
          <span className="flex items-center gap-1">
            <Check className="size-3.5" aria-hidden="true" />
            acknowledge
          </span>
        </Button>
      )}
      {layout === 'standalone' && (
        <Button
          type="button"
          variant="plain"
          disabled={disabled}
          data-wait-action="remove"
          onClick={onRemove}
          aria-label={`Remove wait: ${wait.label}`}
          className="size-6 shrink-0"
        >
          <X className="size-3" aria-hidden="true" />
        </Button>
      )}
    </>
  )
  const body = (
    <div
      className={cn(
        'font-sans text-sm leading-relaxed',
        'pl-5',
        isResolved && 'text-muted-foreground line-through',
      )}
    >
      <EditableMarkdownDescription
        variant="inline"
        defaultValue={wait.body}
        placeholder="Add wait details..."
        editButtonLabel="Edit wait details"
        onChange={onBodyChange}
        onExitEditMode={onExitEditMode}
      />
    </div>
  )
  const entryErrors = errors ?? null

  if (layout === 'github-blocker') {
    return (
      <>
        <div
          className={cn(
            'flex min-h-7 flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-muted-foreground',
            needsAcknowledgement && 'text-primary',
          )}
        >
          {header}
        </div>
        {body}
        {entryErrors}
      </>
    )
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-1.5 border-b border-border px-3 py-2 last:border-b-0',
        isResolved && !needsAcknowledgement && 'opacity-55',
      )}
    >
      <div
        className={cn(
          'flex min-h-7 flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-muted-foreground',
          needsAcknowledgement && 'text-primary',
        )}
      >
        {header}
      </div>
      {body}
      {entryErrors}
    </div>
  )
}
