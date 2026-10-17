import { Button } from '@fohte/ui/button'
import { Input } from '@fohte/ui/input'
import { List, ListItem } from '@fohte/ui/list'
import { Popover, PopoverContent } from '@fohte/ui/popover'
import { useRef } from 'react'

import {
  SidebarField,
  sidebarFieldValueButtonClassName,
} from '#components/task/sidebar-field'
import { formatAbsoluteReminder, REMINDER_PRESETS } from '#lib/reminder-input'

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
        <div className="px-1">
          <Input
            ref={inputRef}
            type="text"
            variant="ghost"
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
            placeholder="in 1h, 明日9時"
            autoFocus
            className="w-full"
          />
        </div>
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
      <Popover open={isEditing} onOpenChange={onOpenChange} anchor={inputRef}>
        <PopoverContent
          // The input owns keyboard navigation, so keep focus there while the
          // reminder options are open.
          initialFocus={false}
          padding="none"
          className="w-64"
        >
          <div className="text-popover-foreground">
            <List role="listbox">
              <ListItem onSelect={onClear}>None</ListItem>
            </List>
            <div className="mt-1 border-t border-border pt-1">
              {query.trim() === '' ? (
                <List role="listbox">
                  {REMINDER_PRESETS.map((preset) => (
                    <ListItem
                      key={preset}
                      onSelect={() => {
                        onSelectPreset(preset)
                      }}
                    >
                      {preset}
                    </ListItem>
                  ))}
                </List>
              ) : parsedDate != null ? (
                <List role="listbox">
                  <ListItem
                    onSelect={() => {
                      onCommit(parsedDate)
                    }}
                  >
                    {formatAbsoluteReminder(parsedDate)}
                  </ListItem>
                </List>
              ) : (
                <div className="px-3 py-1.5 text-sm text-muted-foreground">
                  Unrecognized date
                </div>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </SidebarField>
  )
}
