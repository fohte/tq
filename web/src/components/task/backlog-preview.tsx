import { Chip } from '#components/ui/chip'
import type { Task } from '#hooks/use-tasks'

export function BacklogPreview({
  tasks,
  onViewAll,
}: {
  tasks: Task[]
  onViewAll: () => void
}) {
  if (tasks.length === 0) return null

  return (
    <div className="flex items-center gap-2 border-t border-border px-3 py-2">
      <span className="font-mono text-[11px] text-muted-foreground-faint">
        ▸
      </span>
      <span className="font-mono text-[11px] text-muted-foreground-strong">
        backlog
      </span>
      <Chip className="text-muted-foreground-faint">{tasks.length}</Chip>
      <button
        type="button"
        onClick={onViewAll}
        className="ml-auto font-mono text-[11px] whitespace-nowrap text-primary hover:underline"
      >
        view all →
      </button>
    </div>
  )
}
