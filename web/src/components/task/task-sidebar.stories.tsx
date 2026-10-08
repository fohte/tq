import type { Meta, StoryObj } from '@storybook/react-vite'
import { useLayoutEffect, useRef } from 'react'

import { makeProjectDetail } from '#components/project/project-test-fixtures'
import { makeGithubLink } from '#components/task/github-link-test-fixtures'
import { TaskSidebar } from '#components/task/task-detail-sidebar'
import { makeTaskDetail } from '#components/task/task-row-test-fixtures'
import { TaskSidebarStoryProviders } from '#components/task/task-sidebar-story-test-fixtures'
import { makeTimeBlock } from '#components/task/time-block-test-fixtures'
import type { ProjectDetail } from '#hooks/use-projects'
import type { TaskDetail } from '#hooks/use-tasks'

const baseTask = makeTaskDetail({
  childCompletionCount: { completed: 1, total: 3 },
})

function SidebarPanelStoryView({
  task,
  defaultOpen,
  scrollToTimeBlocks,
}: {
  task: TaskDetail
  defaultOpen?: boolean | undefined
  scrollToTimeBlocks: boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!scrollToTimeBlocks) return
    const panel = containerRef.current?.querySelector<HTMLElement>(
      '[data-slot="detail-sidebar-panel"]',
    )
    if (panel) panel.scrollTop = panel.scrollHeight
  }, [scrollToTimeBlocks])

  return (
    <div ref={containerRef}>
      <TaskSidebar task={task} defaultOpen={defaultOpen} />
    </div>
  )
}

function SidebarStory({
  task,
  project,
  defaultOpen,
  scrollToTimeBlocks = false,
}: {
  task: TaskDetail
  project?: ProjectDetail | undefined
  defaultOpen?: boolean | undefined
  scrollToTimeBlocks?: boolean | undefined
}) {
  return (
    <TaskSidebarStoryProviders project={project}>
      <SidebarPanelStoryView
        task={task}
        defaultOpen={defaultOpen}
        scrollToTimeBlocks={scrollToTimeBlocks}
      />
    </TaskSidebarStoryProviders>
  )
}

const meta = {
  title: 'Task/TaskDetail/Sidebar',
  component: SidebarStory,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof SidebarStory>

export default meta
type Story = StoryObj<typeof meta>

export const Sidebar: Story = {
  name: 'the sidebar shows a task with its usual details',
  args: {
    task: { ...baseTask },
  },
}

export const SidebarMinimal: Story = {
  name: 'a minimal task leaves optional sidebar fields empty',
  args: {
    task: {
      ...baseTask,
      startDate: null,
      dueDate: null,
      parentId: null,
      context: 'personal',
    },
  },
}

export const SidebarWithChecklistProgress: Story = {
  name: 'the sidebar shows checklist progress',
  args: {
    task: makeTaskDetail({
      checklistCompletionCount: { completed: 1, total: 4 },
    }),
  },
}

// Desktop only: at the mobile viewport the sidebar's fields already fill the
// frame, pushing the GitHub link section below the fold and leaving this
// screenshot identical to Sidebar.
export const SidebarWithGithubLink: Story = {
  name: 'a GitHub issue appears in the task sidebar',
  tags: ['desktop-only'],
  args: {
    task: {
      ...baseTask,
      githubLinks: [makeGithubLink({ title: 'Implement task detail page' })],
    },
  },
}

const sampleProject: ProjectDetail = makeProjectDetail({
  id: 'aaaa0000-0000-0000-0000-000000000000',
  completionRate: 0.4,
  taskCount: { total: 10, completed: 4 },
})

// Desktop only: the project row is below the fold at the mobile viewport.
export const SidebarWithProject: Story = {
  name: 'the linked project appears in the task sidebar',
  tags: ['desktop-only'],
  args: {
    task: { ...baseTask, projectId: sampleProject.id },
    project: sampleProject,
  },
}

export const SidebarWithTimeBlocks: Story = {
  name: 'scheduled and manual time blocks appear in the task sidebar',
  tags: ['desktop-only'],
  args: {
    task: {
      ...baseTask,
      timeBlocks: [
        makeTimeBlock({
          id: 'block-1',
          taskId: baseTask.id,
          startTime: '2026-07-30T10:00:00.000Z',
          endTime: '2026-07-30T11:30:00.000Z',
          isAutoScheduled: true,
        }),
        makeTimeBlock({
          id: 'block-2',
          taskId: baseTask.id,
          startTime: '2026-07-29T16:00:00.000Z',
          endTime: '2026-07-29T16:45:00.000Z',
          isAutoScheduled: false,
        }),
      ],
    },
    scrollToTimeBlocks: true,
  },
}

// These three stories render the STATUS select already open (defaultOpen)
// to exercise the "Close as" group (completed / not planned / duplicate),
// which the closed trigger alone never renders.
export const SidebarCompletedOpen: Story = {
  name: 'the status menu is open for a completed task',
  args: {
    task: { ...baseTask, status: 'completed', statusReason: 'completed' },
    defaultOpen: true,
  },
}

export const SidebarNotPlannedOpen: Story = {
  name: 'the status menu is open for a task marked not planned',
  args: {
    task: { ...baseTask, status: 'completed', statusReason: 'not_planned' },
    defaultOpen: true,
  },
}

export const SidebarDuplicateOpen: Story = {
  name: 'the status menu is open for a duplicate task',
  args: {
    task: { ...baseTask, status: 'completed', statusReason: 'duplicate' },
    defaultOpen: true,
  },
}
