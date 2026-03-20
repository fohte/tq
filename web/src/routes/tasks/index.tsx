import { createFileRoute } from '@tanstack/react-router'
import {
  CreateTaskInline,
  FloatingActionButton,
} from '@web/components/task/create-task-inline'
import { TaskListHeader } from '@web/components/task/task-list-header'
import { TaskRow } from '@web/components/task/task-row'
import type { Task } from '@web/hooks/use-tasks'
import { useTaskList } from '@web/hooks/use-tasks'
import { cn } from '@web/lib/utils'
import { useState } from 'react'

export const Route = createFileRoute('/tasks/')({
  component: TaskList,
})

type Tab = 'today' | 'all' | 'backlog'

function TaskList() {
  const [activeTab, setActiveTab] = useState<Tab>('today')
  const [isCreating, setIsCreating] = useState(false)
  const { data: tasks = [], isLoading } = useTaskList()

  const backlogTasks = tasks.filter(
    (t) => t.status === 'todo' && !t.dueDate && !t.startDate,
  )
  const backlogIds = new Set(backlogTasks.map((t) => t.id))
  const todayTasks = tasks.filter(
    (t) => t.status !== 'completed' && !backlogIds.has(t.id),
  )

  const displayTasks: Task[] = (() => {
    switch (activeTab) {
      case 'today':
        return todayTasks
      case 'all':
        return tasks
      case 'backlog':
        return backlogTasks
    }
  })()

  const backlogCount = backlogTasks.length

  return (
    <div className="flex h-full flex-col">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border px-3 py-2">
        {(['today', 'all', 'backlog'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              'rounded-md px-3 py-1 text-sm font-medium transition-colors',
              activeTab === tab
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab === 'today' ? 'Today' : tab === 'all' ? 'All' : 'Backlog'}
            {tab === 'backlog' && backlogCount > 0 && (
              <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 py-0.5 text-xs">
                {backlogCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Summary header (Today tab) */}
      {activeTab === 'today' && (
        <div className="py-2">
          <TaskListHeader tasks={tasks} />
        </div>
      )}

      {/* Inline create */}
      {isCreating && (
        <div className="border-b border-border">
          <CreateTaskInline onClose={() => setIsCreating(false)} />
        </div>
      )}

      {/* Task list */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Loading...
          </div>
        ) : displayTasks.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            {activeTab === 'backlog' ? 'No backlog tasks' : 'No tasks yet'}
          </div>
        ) : (
          <div className="py-1">
            {displayTasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </div>
        )}
      </div>

      {/* FAB (mobile only) */}
      <FloatingActionButton onClick={() => setIsCreating(true)} />
    </div>
  )
}
