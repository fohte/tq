import type { TriggerChar } from '#lib/task-input-parser'
import { cn } from '#lib/utils'

// Mobile-only row of trigger buttons for `CreateTaskInline`'s input — typing
// symbols like `^`/`%` is awkward on a phone keyboard, so tapping a button
// inserts the trigger at the cursor and opens its suggestion menu, same as
// typing it would.
export function CreateTaskInputAccessoryBar({
  triggers,
  onTriggerTap,
}: {
  triggers: TriggerChar[]
  onTriggerTap: (trigger: TriggerChar) => void
}) {
  return (
    <div className="flex md:hidden">
      {triggers.map((trigger, index) => (
        <button
          key={trigger}
          type="button"
          className={cn(
            'min-h-[44px] flex-1 border border-border font-mono text-xs text-muted-foreground-strong',
            index > 0 && 'border-l-0',
          )}
          onMouseDown={(e) => {
            e.preventDefault()
            onTriggerTap(trigger)
          }}
        >
          {trigger}
        </button>
      ))}
    </div>
  )
}
