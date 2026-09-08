import { useRef, useState } from 'react'

import {
  fieldValueClassName,
  SidebarField,
} from '#components/task/sidebar-field'
import { AnchoredPopup } from '#components/ui/anchored-popup'
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
  'block w-full px-3 py-1.5 text-left text-sm text-popover-foreground hover:bg-accent/50'

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
  const inputRef = useRef<HTMLInputElement>(null)
  // Guards against an in-flight parse for a stale keystroke overwriting the
  // result of a newer one once its dynamic import resolves.
  const requestIdRef = useRef(0)

  const updateTask = useUpdateTask()

  const stopEditing = () => {
    setIsEditing(false)
    setQuery('')
    setParsedDate(null)
  }

  const commit = (date: Date) => {
    updateTask.mutate({ id: taskId, input: { remindAt: date.toISOString() } })
    stopEditing()
  }

  const clear = () => {
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
    void parseReminderInput(preset).then((date) => {
      if (date != null) commit(date)
    })
  }

  return (
    <SidebarField label="REMIND">
      {isEditing ? (
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            handleQueryChange(e.target.value)
          }}
          onBlur={stopEditing}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && parsedDate != null) {
              e.preventDefault()
              commit(parsedDate)
            }
            if (e.key === 'Escape') {
              e.preventDefault()
              stopEditing()
            }
          }}
          placeholder="明日9時 など"
          autoFocus
          className={fieldValueClassName}
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setIsEditing(true)
          }}
          className="w-full cursor-text truncate text-left transition-colors hover:text-muted-foreground-strong"
        >
          {remindAt != null
            ? formatReminderSummary(new Date(remindAt))
            : 'なし'}
        </button>
      )}
      <AnchoredPopup
        open={isEditing}
        onOpenChange={(open) => {
          if (!open) stopEditing()
        }}
        anchor={inputRef}
        // Base UI's popover moves focus to the popup's first focusable
        // element (the "なし" button below) as soon as it opens. That races
        // the anchor `Input`'s own `autoFocus` and steals keystrokes away
        // from it, so keep focus on the input instead.
        initialFocus={false}
        className="w-64"
      >
        <button
          type="button"
          className={popupRowClassName}
          onMouseDown={(e) => {
            e.preventDefault()
            clear()
          }}
        >
          なし
        </button>
        <div className="mt-1 border-t border-border pt-1">
          {query.trim() === '' ? (
            REMINDER_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={popupRowClassName}
                onMouseDown={(e) => {
                  e.preventDefault()
                  selectPreset(preset)
                }}
              >
                {preset}
              </button>
            ))
          ) : parsedDate != null ? (
            <button
              type="button"
              className={cn(popupRowClassName, 'font-mono')}
              onMouseDown={(e) => {
                e.preventDefault()
                commit(parsedDate)
              }}
            >
              {formatAbsoluteReminder(parsedDate)}
            </button>
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
