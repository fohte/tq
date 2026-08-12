import type { TriggerChar } from '#lib/task-input-parser'
import { cn } from '#lib/utils'

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
            'min-h-11 flex-1 border border-border font-mono text-xs text-muted-foreground-strong',
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
