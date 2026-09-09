import { Badge } from '#components/ui/badge'
import { DeleteConfirmButton } from '#components/ui/delete-confirm-button'
import type { TimeBlock } from '#hooks/use-time-blocks'
import { formatMinutes } from '#lib/format'

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function formatBlockDate(iso: string): string {
  const d = new Date(iso)
  return `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function formatBlockRange(startIso: string, endIso: string): string {
  const start = new Date(startIso)
  const end = new Date(endIso)
  return `${pad2(start.getHours())}:${pad2(start.getMinutes())}–${pad2(end.getHours())}:${pad2(end.getMinutes())}`
}

function durationMinutes(startIso: string, endIso: string): number {
  return Math.round(
    (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000,
  )
}

export function TimeBlockCard({
  block,
  onDelete,
  isDeleting,
}: {
  block: Pick<TimeBlock, 'startTime' | 'endTime' | 'isAutoScheduled'>
  onDelete: () => void
  isDeleting?: boolean | undefined
}) {
  return (
    <div className="flex items-center justify-between gap-1 border border-border bg-card p-2 font-mono text-2xs text-muted-foreground-strong">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground-faint">
          {formatBlockDate(block.startTime)}
        </span>
        <span>{formatBlockRange(block.startTime, block.endTime)}</span>
        <span className="text-muted-foreground-faint">
          ({formatMinutes(durationMinutes(block.startTime, block.endTime))})
        </span>
        <Badge variant="outline">
          {block.isAutoScheduled ? 'auto' : 'manual'}
        </Badge>
      </div>
      <DeleteConfirmButton
        title={
          block.isAutoScheduled ? 'Remove from queue' : 'Delete time block'
        }
        description={
          block.isAutoScheduled
            ? "This task will be removed from that day's queue and won't be auto-scheduled again unless you re-add it."
            : 'Are you sure you want to delete this time block? This action cannot be undone.'
        }
        onDelete={onDelete}
        disabled={isDeleting}
        aria-label={
          block.isAutoScheduled ? 'Remove from queue' : 'Delete time block'
        }
      />
    </div>
  )
}
