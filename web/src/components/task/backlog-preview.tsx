import type { Task } from '@web/hooks/use-tasks'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'

export function BacklogPreview({
  tasks,
  onViewAll,
}: {
  tasks: Task[]
  onViewAll: () => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const previewTasks = tasks.slice(0, 3)

  if (tasks.length === 0) return null

  return (
    <div className="border-t border-border px-3 py-2">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-2 py-1 text-sm text-muted-foreground hover:text-foreground"
      >
        {isOpen ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        <span>Backlog</span>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
          {tasks.length}
        </span>
      </button>

      {isOpen && (
        <div className="mt-1 space-y-1 pl-6">
          {previewTasks.map((task) => (
            <div
              key={task.id}
              className="truncate text-sm text-muted-foreground"
            >
              {task.title}
            </div>
          ))}
          {tasks.length > 3 && (
            <button
              type="button"
              onClick={onViewAll}
              className="text-sm text-primary hover:underline"
            >
              View all →
            </button>
          )}
        </div>
      )}
    </div>
  )
}
