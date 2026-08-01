import { Link } from '@tanstack/react-router'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'

import { Chip } from '#components/ui/chip'
import type { Task } from '#hooks/use-tasks'

export function BacklogPreview({ tasks }: { tasks: Task[] }) {
  const [isOpen, setIsOpen] = useState(false)
  const previewTasks = tasks.slice(0, 3)

  if (tasks.length === 0) return null

  return (
    <div className="border-t border-border px-3 py-2">
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen)
        }}
        className="flex w-full items-center gap-2 py-1 font-mono text-xs text-muted-foreground hover:text-foreground"
      >
        {isOpen ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        <span>backlog</span>
        <Chip>{tasks.length}</Chip>
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
            <Link
              to="/tasks"
              className="font-mono text-xs text-primary hover:underline"
            >
              view all →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
