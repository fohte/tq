import { Check, Plus } from 'lucide-react'

import { Button } from '#components/ui/button'

export function TodayQueueToggle({
  inQueue,
  onToggle,
}: {
  inQueue: boolean
  onToggle: () => void
}) {
  return (
    <Button
      type="button"
      variant={inQueue ? 'secondary' : 'outline'}
      size="xs"
      onClick={onToggle}
      aria-pressed={inQueue}
      className="gap-1 font-mono"
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
    </Button>
  )
}
