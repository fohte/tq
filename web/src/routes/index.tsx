import { createFileRoute } from '@tanstack/react-router'
import { CalendarView } from '@web/components/calendar/calendar-view'
import { BacklogPreview } from '@web/components/task/backlog-preview'
import { CreateTaskInline } from '@web/components/task/create-task-inline'
import { TaskListHeader } from '@web/components/task/task-list-header'
import { TaskRow } from '@web/components/task/task-row'
import type { Task } from '@web/hooks/use-tasks'
import { useTaskList } from '@web/hooks/use-tasks'
import { cn } from '@web/lib/utils'
import { Plus } from 'lucide-react'
import { useState } from 'react'

export const Route = createFileRoute('/')({
  component: DayView,
})

type TaskTab = 'today' | 'all'
type MobileTab = 'calendar' | 'tasks'

const MOBILE_TABS = [
  { value: 'calendar', label: 'Calendar' },
  { value: 'tasks', label: 'Tasks' },
] as const

function DayView() {
  const [activeTab, setActiveTab] = useState<TaskTab>('today')
  const [mobileTab, setMobileTab] = useState<MobileTab>('calendar')
  const [isCreating, setIsCreating] = useState(false)
  const { isLoading, categorized } = useTaskList()

  const displayTasks: Task[] =
    activeTab === 'today' ? categorized.today : categorized.all

  return (
    <div className="flex h-full">
      {/* Left panel: Today's Queue - hidden on mobile when calendar tab is active */}
      <div
        className={cn(
          'flex w-full flex-col border-r border-border md:w-80 lg:w-96',
          mobileTab === 'calendar' ? 'hidden md:flex' : 'flex md:flex',
        )}
      >
        {/* Tab bar */}
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <div className="flex gap-1">
            {(['today', 'all'] as const).map((tab) => (
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
                {tab === 'today' ? 'Today' : 'All'}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Summary header */}
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
              No tasks yet
            </div>
          ) : (
            <div className="py-1">
              {displayTasks.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </div>
          )}
        </div>

        {/* Backlog preview (Today tab only) */}
        {activeTab === 'today' && (
          <BacklogPreview
            tasks={categorized.backlog}
            onViewAll={() => setActiveTab('all')}
          />
        )}
      </div>

      {/* Right panel: Calendar */}
      <div
        className={cn(
          'flex-1',
          mobileTab === 'tasks' ? 'hidden md:flex' : 'flex md:flex',
        )}
      >
        <div className="flex h-full w-full flex-col">
          <CalendarView />
        </div>
      </div>

      {/* Mobile tab switcher */}
      <div className="fixed bottom-16 left-1/2 z-10 flex -translate-x-1/2 gap-0.5 rounded-lg bg-secondary p-0.5 shadow-lg md:hidden">
        {MOBILE_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setMobileTab(tab.value)}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              mobileTab === tab.value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}
