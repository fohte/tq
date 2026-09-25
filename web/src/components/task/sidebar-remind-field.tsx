import { useRef, useState } from 'react'

import {
  SidebarField,
  sidebarFieldValueButtonClassName,
} from '#components/task/sidebar-field'
import { AnchoredPopup } from '#components/ui/anchored-popup'
import { Button } from '#components/ui/button'
import { Input } from '#components/ui/input'
import { useUpdateTask } from '#hooks/use-tasks'
import {
  formatAbsoluteReminder,
  formatReminderSummary,
  parseReminderInput,
  REMINDER_PRESETS,
} from '#lib/reminder-input'
import { cn } from '#lib/utils'

const popupRowClassName =
  'h-auto min-h-0 shrink whitespace-normal gap-0 rounded-none border-0 bg-transparent p-0 font-sans font-normal shadow-none transition-none hover:bg-transparent active:translate-y-0 block w-full px-3 py-1.5 text-left text-sm text-popover-foreground hover:bg-accent/50'

export function SidebarRemindFieldAppearance({
  remindAtLabel,
  isEditing,
  onOpenChange,
  query,
  onQueryChange,
  parsedDate,
  onClear,
  onSelectPreset,
  onCommit,
}: {
  remindAtLabel: string
  isEditing: boolean
  onOpenChange: (open: boolean) => void
  query: string
  onQueryChange: (value: string) => void
  parsedDate: Date | null
  onClear: () => void
  onSelectPreset: (preset: string) => void
  onCommit: (date: Date) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <SidebarField label="REMIND">
      {isEditing ? (
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            onQueryChange(e.target.value)
          }}
          onBlur={() => {
            onOpenChange(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && parsedDate != null) {
              e.preventDefault()
              onCommit(parsedDate)
            }
            if (e.key === 'Escape') {
              e.preventDefault()
              onOpenChange(false)
            }
          }}
          placeholder="明日9時 など"
          autoFocus
          className="h-auto w-full justify-start gap-1 border-0 bg-transparent dark:bg-transparent p-0 font-mono text-xs md:text-xs text-foreground shadow-none hover:text-muted-foreground-strong focus-visible:ring-0"
        />
      ) : (
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            onOpenChange(true)
          }}
          className={`${sidebarFieldValueButtonClassName} min-w-0`}
        >
          <span className="min-w-0 truncate">{remindAtLabel}</span>
        </Button>
      )}
      <AnchoredPopup
        open={isEditing}
        onOpenChange={onOpenChange}
        anchor={inputRef}
        // Base UI's popover moves focus to the popup's first focusable
        // element (the "なし" button below) as soon as it opens. That races
        // the anchor `Input`'s own `autoFocus` and steals keystrokes away
        // from it, so keep focus on the input instead.
        initialFocus={false}
        className="w-64"
      >
        <Button
          type="button"
          variant="ghost"
          className={popupRowClassName}
          onMouseDown={(e) => {
            e.preventDefault()
            onClear()
          }}
        >
          なし
        </Button>
        <div className="mt-1 border-t border-border pt-1">
          {query.trim() === '' ? (
            REMINDER_PRESETS.map((preset) => (
              <Button
                key={preset}
                type="button"
                variant="ghost"
                className={popupRowClassName}
                onMouseDown={(e) => {
                  e.preventDefault()
                  onSelectPreset(preset)
                }}
              >
                {preset}
              </Button>
            ))
          ) : parsedDate != null ? (
            <Button
              type="button"
              variant="ghost"
              className={cn(popupRowClassName, 'font-mono')}
              onMouseDown={(e) => {
                e.preventDefault()
                onCommit(parsedDate)
              }}
            >
              {formatAbsoluteReminder(parsedDate)}
            </Button>
          ) : (
            <div className="px-3 py-1.5 text-sm text-muted-foreground">
              解釈できません
            </div>
          )}
        </div>
      </AnchoredPopup>
    </SidebarField>
  )
}

export function SidebarRemindField({
  taskId,
  remindAt,
}: {
  taskId: string
  remindAt: string | null
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [query, setQuery] = useState('')
  const [parsedDate, setParsedDate] = useState<Date | null>(null)
  // Guards against an in-flight parse for a stale keystroke overwriting the
  // result of a newer one once its dynamic import resolves.
  const requestIdRef = useRef(0)

  const updateTask = useUpdateTask()

  const stopEditing = () => {
    setIsEditing(false)
    setQuery('')
    setParsedDate(null)
  }

  // A committing action (confirming a value or clearing) always wins over
  // any still-in-flight parse from an earlier action — bumping the token
  // here makes that earlier parse's eventual `.then` a no-op.
  const commit = (date: Date) => {
    requestIdRef.current++
    updateTask.mutate({ id: taskId, input: { remindAt: date.toISOString() } })
    stopEditing()
  }

  const clear = () => {
    requestIdRef.current++
    updateTask.mutate({ id: taskId, input: { remindAt: null } })
    stopEditing()
  }

  const handleQueryChange = (value: string) => {
    setQuery(value)
    const requestId = ++requestIdRef.current

    if (value.trim() === '') {
      setParsedDate(null)
      return
    }
    void parseReminderInput(value).then((date) => {
      if (requestIdRef.current !== requestId) return
      setParsedDate(date)
    })
  }

  const selectPreset = (preset: string) => {
    const requestId = ++requestIdRef.current
    void parseReminderInput(preset).then((date) => {
      if (requestIdRef.current !== requestId) return
      if (date != null) commit(date)
    })
  }

  return (
    <SidebarRemindFieldAppearance
      remindAtLabel={
        remindAt != null ? formatReminderSummary(new Date(remindAt)) : 'なし'
      }
      isEditing={isEditing}
      onOpenChange={(open) => {
        if (open) {
          setIsEditing(true)
        } else {
          stopEditing()
        }
      }}
      query={query}
      onQueryChange={handleQueryChange}
      parsedDate={parsedDate}
      onClear={clear}
      onSelectPreset={selectPreset}
      onCommit={commit}
    />
  )
}
