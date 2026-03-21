import { createFileRoute } from '@tanstack/react-router'
import {
  CreateTaskInline,
  FloatingActionButton,
} from '@web/components/task/create-task-inline'
import { CreateTaskModal } from '@web/components/task/create-task-modal'
import { TaskListHeader } from '@web/components/task/task-list-header'
import { TaskRow, TreeTaskRow } from '@web/components/task/task-row'
import type { Task } from '@web/hooks/use-tasks'
import { useTaskList, useTaskTree } from '@web/hooks/use-tasks'
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
  const { isLoading, categorized } = useTaskList()
  const { data: treeData, isLoading: isTreeLoading } = useTaskTree()

  const displayTasks: Task[] = (() => {
    switch (activeTab) {
      case 'today':
        return categorized.today
      case 'all':
        return categorized.all
      case 'backlog':
        return categorized.backlog
    }
  })()

  const showTree = activeTab === 'all'
  const loading = showTree ? isTreeLoading : isLoading
  const isEmpty = showTree
    ? (treeData ?? []).length === 0
    : displayTasks.length === 0

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
            {tab === 'backlog' && categorized.backlog.length > 0 && (
              <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 py-0.5 text-xs">
                {categorized.backlog.length}
              </span>
            )}
          </button>
        ))}
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
            {(treeData ?? []).map((node) => (
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
