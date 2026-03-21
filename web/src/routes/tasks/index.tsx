import { createFileRoute } from '@tanstack/react-router'
import { ContextFilterInline } from '@web/components/context-filter'
import {
  CreateTaskInline,
  FloatingActionButton,
} from '@web/components/task/create-task-inline'
import { CreateTaskModal } from '@web/components/task/create-task-modal'
import { TaskListHeader } from '@web/components/task/task-list-header'
import { TaskRow } from '@web/components/task/task-row'
import {
  filterModeToApiContext,
  matchesContextFilter,
  useContextFilter,
} from '@web/hooks/use-context-filter'
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
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { mode } = useContextFilter()
  const apiContext = filterModeToApiContext(mode)
  const { isLoading, categorized } = useTaskList(
    apiContext ? { context: apiContext } : undefined,
  )

  // For 'personal' mode, API returns all tasks (no server filter),
  // so we filter client-side to include both 'personal' and 'dev'.
  const filterByContext = (tasks: Task[]): Task[] => {
    if (mode === 'all' || mode === 'work') return tasks
    return tasks.filter((t) => matchesContextFilter(t.context, mode))
  }

  const displayTasks: Task[] = (() => {
    switch (activeTab) {
      case 'today':
        return filterByContext(categorized.today)
      case 'all':
        return filterByContext(categorized.all)
      case 'backlog':
        return filterByContext(categorized.backlog)
    }
  })()

  return (
    <div className="flex h-full flex-col">
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-border px-3 py-2">
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
            {tab === 'backlog' && categorized.backlog.length > 0 && (
              <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 py-0.5 text-xs">
                {categorized.backlog.length}
              </span>
            )}
          </button>
        ))}
        <div className="ml-auto">
          <ContextFilterInline />
        </div>
      </div>

      {/* Summary header (Today tab) */}
      {activeTab === 'today' && (
        <div className="py-2">
          <TaskListHeader tasks={categorized.nonBacklog} />
        </div>
      )}

      {/* Inline create */}
      {isCreating && (
        <div className="border-b border-border">
          <CreateTaskInline
            onClose={() => setIsCreating(false)}
            {...(activeTab === 'today'
              ? { defaultStartDate: new Date().toISOString().slice(0, 10) }
              : {})}
          />
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
      <FloatingActionButton onClick={() => setIsModalOpen(true)} />

      {/* Task create modal */}
      <CreateTaskModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        {...(activeTab === 'today'
          ? { defaultStartDate: new Date().toISOString().slice(0, 10) }
          : {})}
      />
    </div>
  )
}
