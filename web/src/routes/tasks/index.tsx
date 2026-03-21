import { createFileRoute } from '@tanstack/react-router'
import { ContextFilterInline } from '@web/components/context-filter'
import {
  CreateTaskInline,
  FloatingActionButton,
} from '@web/components/task/create-task-inline'
import { CreateTaskModal } from '@web/components/task/create-task-modal'
import { TaskListHeader } from '@web/components/task/task-list-header'
import { TaskRow, TreeTaskRow } from '@web/components/task/task-row'
import {
  filterByContext,
  filterModeToApiContext,
  filterTreeByContext,
  useContextFilter,
} from '@web/hooks/use-context-filter'
import type { Task } from '@web/hooks/use-tasks'
import { useTaskList, useTaskTree } from '@web/hooks/use-tasks'
import { cn } from '@web/lib/utils'
import { useMemo, useState } from 'react'

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
  const { data: treeData, isLoading: isTreeLoading } = useTaskTree({
    enabled: activeTab === 'all',
  })

  const filteredBacklog = useMemo(
    () => filterByContext(categorized.backlog, mode),
    [categorized.backlog, mode],
  )
  const filteredNonBacklog = useMemo(
    () => filterByContext(categorized.nonBacklog, mode),
    [categorized.nonBacklog, mode],
  )

  const displayTasks = useMemo((): Task[] => {
    switch (activeTab) {
      case 'today':
        return filterByContext(categorized.today, mode)
      case 'all':
        return filterByContext(categorized.all, mode)
      case 'backlog':
        return filteredBacklog
    }
  }, [activeTab, categorized, mode])

  const filteredTreeData = useMemo(
    () => filterTreeByContext(treeData ?? [], mode),
    [treeData, mode],
  )

  const showTree = activeTab === 'all'
  const loading = showTree ? isTreeLoading : isLoading
  const isEmpty = showTree
    ? filteredTreeData.length === 0
    : displayTasks.length === 0

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
            {tab === 'backlog' && filteredBacklog.length > 0 && (
              <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 py-0.5 text-xs">
                {filteredBacklog.length}
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
          <TaskListHeader tasks={filteredNonBacklog} />
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
        {loading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Loading...
          </div>
        ) : isEmpty ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            {activeTab === 'backlog' ? 'No backlog tasks' : 'No tasks yet'}
          </div>
        ) : showTree ? (
          <div className="py-1" data-testid="task-tree">
            {filteredTreeData.map((node) => (
              <TreeTaskRow key={node.id} node={node} />
            ))}
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
