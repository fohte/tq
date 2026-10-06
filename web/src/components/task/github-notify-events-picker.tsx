import { ChevronDown } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '#components/ui/dropdown-menu'

export type GitHubNotifyEvent = 'closed' | 'reopened' | 'comments' | 'other'

const NOTIFY_EVENT_OPTIONS: ReadonlyArray<{
  value: GitHubNotifyEvent
  label: string
  shortLabel: string
}> = [
  { value: 'closed', label: 'closed / merged', shortLabel: 'closed' },
  { value: 'reopened', label: 'reopened', shortLabel: 'reopened' },
  { value: 'comments', label: 'new comments', shortLabel: 'comments' },
  { value: 'other', label: 'other activity', shortLabel: 'other' },
]

export function GitHubNotifyEventsPicker({
  value,
  onChange,
  defaultOpen,
  disabled,
}: {
  value: GitHubNotifyEvent[]
  onChange: (value: GitHubNotifyEvent[]) => void
  defaultOpen?: boolean
  disabled?: boolean
}) {
  const selectedEvents = new Set(value)
  const triggerLabel =
    selectedEvents.size === NOTIFY_EVENT_OPTIONS.length
      ? 'all'
      : NOTIFY_EVENT_OPTIONS.filter((option) =>
          selectedEvents.has(option.value),
        )
          .map((option) => option.shortLabel)
          .join(', ') || 'off'

  return (
    <DropdownMenu defaultOpen={defaultOpen}>
      <DropdownMenuTrigger
        aria-label={`Notify on: ${triggerLabel}`}
        disabled={disabled}
        variant="quiet"
      >
        {triggerLabel}
        <ChevronDown aria-hidden="true" className="size-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <div className="px-1.5 pb-1 pt-1 font-mono text-xs text-muted-foreground-faint">
          Notify on
        </div>
        {NOTIFY_EVENT_OPTIONS.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={selectedEvents.has(option.value)}
            onCheckedChange={(checked) => {
              const nextSelectedEvents = new Set(selectedEvents)
              if (checked) {
                nextSelectedEvents.add(option.value)
              } else {
                nextSelectedEvents.delete(option.value)
              }

              onChange(
                NOTIFY_EVENT_OPTIONS.filter((eventOption) =>
                  nextSelectedEvents.has(eventOption.value),
                ).map((eventOption) => eventOption.value),
              )
            }}
          >
            {option.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
