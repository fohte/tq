import { cn } from '@web/lib/utils'
import { Check, Plus } from 'lucide-react'

export function TodayQueueToggle({
  inQueue,
  onToggle,
}: {
  inQueue: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={inQueue}
      className={cn(
        'flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium transition-colors',
        inQueue
          ? 'bg-primary/10 text-primary hover:bg-primary/20'
          : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
      )}
    >
      {inQueue ? (
        <>
          <Check className="h-3.5 w-3.5" />
          In Today
        </>
      ) : (
        <>
          <Plus className="h-3.5 w-3.5" />
          Add to Today
        </>
      )}
    </button>
  )
}
