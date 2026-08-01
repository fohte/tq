import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useState } from 'react'

import { ContextFilterInline } from '#components/context-filter'
import { TagFilterBar } from '#components/tag-filter-bar'
import { TagFilterChips } from '#components/tag-filter-chips'
import {
  CreateTaskInline,
  FloatingActionButton,
} from '#components/task/create-task-inline'
import { CreateTaskModal } from '#components/task/create-task-modal'
import { GithubIssueLinkModal } from '#components/task/github-issue-link-modal'
import { TaskGridRow } from '#components/task/task-grid-row'
import { TASK_GRID_COLUMNS } from '#components/task/task-row-shared'
import { TreeTaskGridRow } from '#components/task/tree-task-grid-row'
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
import { useNewTaskShortcutListener } from '#hooks/use-new-task-shortcut'
import { newTaskKeybinding } from '#lib/keybindings'

export const Route = createFileRoute('/tasks/')({
  component: TaskList,
})

type Tab = 'all' | 'backlog'

function TaskListColumnHeader() {
  return (
    <div
      className={`hidden items-center gap-2 border-b border-border bg-card px-3 py-[5px] font-mono text-[9px] tracking-[0.08em] text-muted-foreground-faint md:grid ${TASK_GRID_COLUMNS}`}
    >
      <span />
      <span />
      <span>TITLE</span>
      <span>TAGS</span>
      <span>LINK</span>
      <span className="text-right">EST</span>
      <span className="text-right">DUE</span>
    </div>
  )
}

function TaskList() {
  const [activeTab, setActiveTab] = useState<Tab>('all')
  const [isCreating, setIsCreating] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isGithubModalOpen, setIsGithubModalOpen] = useState(false)

  const tasks = useFilteredTaskList()
  const { isLoading: isTreeLoading, tree: filteredTreeData } =
    useFilteredTaskTree({ enabled: activeTab === 'all' })

  useNewTaskShortcutListener(
    useCallback(() => {
      setIsCreating(true)
    }, []),
  )

  const displayTasks = (() => {
    switch (activeTab) {
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
            <KeybindHint className="text-muted-foreground">
              {newTaskKeybinding.keys}
            </KeybindHint>
          </Button>
        </div>
      </ScreenHeaderBar>

      <TagFilterBar />

      {/* Context filter (mobile only — desktop already has it in the sidebar) */}
      <div className="border-b border-border px-3 py-2 md:hidden">
        <ContextFilterInline />
      </div>

      {/* Tag filter chips (mobile only — desktop already has TAGS in the sidebar) */}
      <div className="md:hidden">
        <TagFilterChips />
      </div>

      {/* Inline create */}
      {isCreating && (
        <div className="border-b border-border">
          <CreateTaskInline
            onClose={() => {
              setIsCreating(false)
            }}
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
              <TreeTaskGridRow key={node.id} node={node} />
            ))}
          </div>
        ) : (
          <div className="py-1">
            {displayTasks.map((task) => (
              <TaskGridRow key={task.id} task={task} />
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
      <CreateTaskModal open={isModalOpen} onOpenChange={setIsModalOpen} />

      {/* Create task from GitHub issue/PR modal */}
      <GithubIssueLinkModal
        open={isGithubModalOpen}
        onOpenChange={setIsGithubModalOpen}
        mode="create"
      />
    </div>
  )
}
