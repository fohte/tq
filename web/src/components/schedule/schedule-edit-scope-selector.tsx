import { Button } from '@fohte/ui/button'

import type { ScheduleEditScope } from '#components/schedule/schedule-edit-dialog-state'

export function ScheduleEditScopeSelector({
  scope,
  setScope,
  reminderReady,
}: {
  scope: ScheduleEditScope
  setScope: (scope: ScheduleEditScope) => void
  reminderReady: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-2xs tracking-widest text-muted-foreground-faint">
        APPLY TO
      </span>
      <div className="grid grid-cols-3 gap-1 rounded-lg border border-border p-1">
        {(
          [
            ['this', 'This event'],
            ['following', 'This and following'],
            ['all', 'All events'],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            type="button"
            variant={scope === value ? 'secondary' : 'ghost'}
            size="sm"
            aria-pressed={scope === value}
            disabled={value === 'all' && !reminderReady}
            onClick={() => {
              setScope(value)
            }}
            className="h-auto min-h-8 w-full min-w-0 whitespace-normal"
          >
            <span className="text-2xs leading-3 md:text-xs md:leading-normal">
              {label}
            </span>
          </Button>
        ))}
      </div>
    </div>
  )
}
