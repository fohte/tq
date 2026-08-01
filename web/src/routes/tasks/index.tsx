import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import { ContextFilterInline } from '#components/context-filter'
import {
  CreateTaskInline,
  FloatingActionButton,
} from '#components/task/create-task-inline'
import { CreateTaskModal } from '#components/task/create-task-modal'
import { GithubIssueLinkModal } from '#components/task/github-issue-link-modal'
import { TaskListHeader } from '#components/task/task-list-header'
import { TaskRow, TreeTaskRow } from '#components/task/task-row'
import { Button } from '#components/ui/button'
import { GithubMarkIcon } from '#components/ui/github-mark-icon'
import { KeybindHint } from '#components/ui/keybind-hint'
import { ScreenHeaderBar } from '#components/ui/screen-header-bar'
import { SectionHeading } from '#components/ui/section-heading'
import { TabStrip } from '#components/ui/tab-strip'
import {
  useFilteredTaskList,
  useFilteredTaskTree,
} from '#hooks/use-filtered-tasks'

export const Route = createFileRoute('/tasks/')({
  component: TaskList,
})

type Tab = 'today' | 'all' | 'backlog'

// TaskRow/TreeTaskRow lay out title/tags/link/est on wrapping flex lines, not
// a matching grid, so these labels are a caption for the list rather than
// literal column headers.
function TaskListColumnHeader() {
  return (
    <div className="hidden items-center gap-2 border-b border-border bg-card px-3 py-[5px] font-mono text-[9px] tracking-[0.08em] text-muted-foreground-faint md:flex">
      <span className="w-[52px] shrink-0" />
      <span className="flex-1">TITLE</span>
      <span className="w-[132px] shrink-0">TAGS</span>
      <span className="w-[104px] shrink-0">LINK</span>
      <span className="w-[72px] shrink-0 text-right">EST</span>
      <span className="w-[56px] shrink-0 text-right">DUE</span>
    </div>
  )
}

function TaskList() {
  const [activeTab, setActiveTab] = useState<Tab>('today')
  const [isCreating, setIsCreating] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isGithubModalOpen, setIsGithubModalOpen] = useState(false)

  const tasks = useFilteredTaskList()
  const { isLoading: isTreeLoading, tree: filteredTreeData } =
    useFilteredTaskTree({ enabled: activeTab === 'all' })

  const displayTasks = (() => {
    switch (activeTab) {
      case 'today':
        return tasks.today
      case 'all':
        return tasks.all
      case 'backlog':
        return tasks.backlog
    }
  })()

  const showTree = activeTab === 'all'
  const loading = showTree ? isTreeLoading : tasks.isLoading
  const isEmpty = showTree
    ? filteredTreeData.length === 0
    : displayTasks.length === 0

  return (
    <div className="flex h-full flex-col">
      <ScreenHeaderBar>
        <SectionHeading level={2}>tasks</SectionHeading>
        <TabStrip
          className="ml-2.5"
          value={activeTab}
          onChange={setActiveTab}
          options={[
            { value: 'today', label: 'today' },
            { value: 'all', label: 'all' },
            {
              value: 'backlog',
              label: (
                <>
                  backlog{' '}
                  <span className="text-muted-foreground-faint">
                    {tasks.backlog.length}
                  </span>
                </>
              ),
            },
          ]}
        />
        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="xs"
            onClick={() => {
              setIsGithubModalOpen(true)
            }}
            aria-label="Create task from GitHub"
          >
            <GithubMarkIcon className="size-[11px]" />
            <span className="hidden md:inline">from issue</span>
          </Button>
          <Button
            type="button"
            size="xs"
            className="hidden md:inline-flex"
            onClick={() => {
              setIsCreating(true)
            }}
          >
            + new
            <KeybindHint className="text-muted-foreground">n</KeybindHint>
          </Button>
        </div>
      </ScreenHeaderBar>

      {/* Context filter (mobile only — desktop already has it in the sidebar) */}
      <div className="border-b border-border px-3 py-2 md:hidden">
        <ContextFilterInline />
      </div>

      {/* Summary header (Today tab) */}
      {activeTab === 'today' && (
        <div className="py-2">
          <TaskListHeader tasks={tasks.nonBacklog} />
        </div>
      )}

      {/* Inline create */}
      {isCreating && (
        <div className="border-b border-border">
          <CreateTaskInline
            onClose={() => {
              setIsCreating(false)
            }}
            {...(activeTab === 'today'
              ? { defaultStartDate: new Date().toISOString().slice(0, 10) }
              : {})}
          />
        </div>
      )}

      <TaskListColumnHeader />

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
      <FloatingActionButton
        onClick={() => {
          setIsModalOpen(true)
        }}
      />

      {/* Task create modal */}
      <CreateTaskModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        {...(activeTab === 'today'
          ? { defaultStartDate: new Date().toISOString().slice(0, 10) }
          : {})}
      />

      {/* Create task from GitHub issue/PR modal */}
      <GithubIssueLinkModal
        open={isGithubModalOpen}
        onOpenChange={setIsGithubModalOpen}
        mode="create"
      />
    </div>
  )
}
