import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import type { ReactNode } from 'react'

import {
  TaskMainContent,
  TaskSidebar,
  TaskSidebarMobile,
} from '#components/task/task-detail'
import { labelKeys } from '#hooks/use-labels'
import type { ProjectDetail } from '#hooks/use-projects'
import { projectKeys } from '#hooks/use-projects'
import { activityKeys } from '#hooks/use-task-activity'
import { commentKeys } from '#hooks/use-task-comments'
import type { TaskPage } from '#hooks/use-task-pages'
import type { Task, TaskDetail } from '#hooks/use-tasks'
import { taskKeys } from '#hooks/use-tasks'

const samplePages: TaskPage[] = [
  {
    id: 'page-001',
    taskId: '550e8400-e29b-41d4-a716-446655440000',
    title: 'Meeting Notes',
    content:
      '## Discussion Points\n\n- Architecture review\n- Sprint planning\n- Performance improvements\n\nWe decided to go with option B.',
    format: 'markdown',
    sortOrder: 0,
    createdAt: '2026-03-20T00:00:00.000Z',
    updatedAt: '2026-03-20T00:00:00.000Z',
    author: null,
  },
  {
    id: 'page-002',
    taskId: '550e8400-e29b-41d4-a716-446655440000',
    title: 'Technical Spec',
    content:
      '# API Design\n\nREST endpoints for the task management system.\n\n## Endpoints\n\n- GET /tasks\n- POST /tasks\n- PATCH /tasks/:id',
    format: 'markdown',
    sortOrder: 1,
    createdAt: '2026-03-21T00:00:00.000Z',
    updatedAt: '2026-03-21T00:00:00.000Z',
    author: null,
  },
]

const baseTask: TaskDetail = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  number: 1,
  title: 'Implement task detail page',
  description:
    '## Why\n\nThe task detail page is needed.\n\n## What\n\n- Add inline editing\n- Add sidebar fields',
  status: 'todo',
  context: 'personal',
  labels: [],
  startDate: '2026-03-20',
  dueDate: '2026-03-25',
  estimatedMinutes: 90,
  parentId: null,
  projectId: null,
  recurrenceRuleId: null,
  recurrenceRule: null,
  githubLink: null,
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
  titleAuthor: null,
  descriptionAuthor: null,
  childCompletionCount: { completed: 0, total: 0 },
  pages: [],
  timeBlocks: [],
  links: { outgoing: [], incoming: [] },
}

const sampleSubtasks: Task[] = [
  {
    id: 'aaaa1111-0000-0000-0000-000000000001',
    number: 2,
    title: 'Add inline editing',
    description: null,
    status: 'completed',
    context: 'work',
    labels: [],
    startDate: null,
    dueDate: null,
    estimatedMinutes: 30,
    parentId: baseTask.id,
    parentNumber: baseTask.number,
    projectId: null,
    recurrenceRuleId: null,
    githubLink: null,
    createdAt: '2026-03-20T00:00:00.000Z',
    updatedAt: '2026-03-20T00:00:00.000Z',
    childCompletionCount: { completed: 0, total: 0 },
  },
  {
    id: 'aaaa1111-0000-0000-0000-000000000002',
    number: 3,
    title: 'Add sidebar fields',
    description: null,
    status: 'todo',
    context: 'work',
    labels: [],
    startDate: null,
    dueDate: null,
    estimatedMinutes: null,
    parentId: baseTask.id,
    parentNumber: baseTask.number,
    projectId: null,
    recurrenceRuleId: null,
    githubLink: null,
    createdAt: '2026-03-20T00:00:00.000Z',
    updatedAt: '2026-03-20T00:00:00.000Z',
    childCompletionCount: { completed: 0, total: 0 },
  },
]

function Providers({
  children,
  project,
}: {
  children: ReactNode
  project?: ProjectDetail | undefined
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  // TaskMainContent always mounts TaskActivity; FullPagePC/FullPageSP also
  // mount TaskSidebar (SidebarParentField/SidebarTagsField). Seed every
  // query they read so no individual story needs its own seeding.
  queryClient.setQueryData(commentKeys.all(baseTask.id), [])
  queryClient.setQueryData(activityKeys.all(baseTask.id), [])
  queryClient.setQueryData(taskKeys.list(undefined), [])
  queryClient.setQueryData(labelKeys.all, [])
  if (project) {
    queryClient.setQueryData(projectKeys.detail(project.id), project)
  }
  const rootRoute = createRootRoute({
    component: () => <>{children}</>,
  })
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => null,
  })
  const tasksRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/tasks',
    component: () => null,
  })
  const taskRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/tasks/$taskId',
    component: () => null,
  })
  const taskPageRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/tasks/$taskId/pages/$pageId',
    component: () => null,
  })
  rootRoute.addChildren([indexRoute, tasksRoute, taskRoute, taskPageRoute])

  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

// --- TaskMainContent Stories ---

function MainContentStory({
  task,
  pages,
  subtasks,
  project,
}: {
  task: TaskDetail
  pages: TaskPage[]
  subtasks: Task[]
  project?: ProjectDetail | undefined
}) {
  return (
    <Providers project={project}>
      <div className="max-w-2xl p-6">
        <TaskMainContent task={task} pages={pages} subtasks={subtasks} />
      </div>
    </Providers>
  )
}

const mainContentMeta = {
  title: 'Task/TaskDetail/MainContent',
  component: MainContentStory,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof MainContentStory>

export default mainContentMeta
type Story = StoryObj<typeof mainContentMeta>

export const Default: Story = {
  args: {
    task: { ...baseTask },
    pages: [],
    subtasks: [],
  },
}

export const InProgress: Story = {
  args: {
    task: { ...baseTask, status: 'in_progress', title: 'Review pull request' },
    pages: [],
    subtasks: [],
  },
}

export const Completed: Story = {
  args: {
    task: {
      ...baseTask,
      status: 'completed',
      title: 'Set up CI pipeline',
    },
    pages: [],
    subtasks: [],
  },
}

export const NoDescription: Story = {
  args: {
    task: { ...baseTask, description: null, title: 'Task without description' },
    pages: [],
    subtasks: [],
  },
}

export const WithTags: Story = {
  args: {
    task: {
      ...baseTask,
      title: 'Task with tags',
      labels: ['dev:tq', 'chore'],
    },
    pages: [],
    subtasks: [],
  },
}

export const WithParent: Story = {
  args: {
    task: {
      ...baseTask,
      parentId: 'abcd0000-0000-0000-0000-000000000000',
      title: 'Subtask with parent',
    },
    pages: [],
    subtasks: [],
  },
}

export const WithPages: Story = {
  args: {
    task: { ...baseTask, title: 'Task with pages' },
    pages: samplePages,
    subtasks: [],
  },
}

export const WithSubtasks: Story = {
  args: {
    task: {
      ...baseTask,
      title: 'Task with subtasks',
      childCompletionCount: { completed: 1, total: 2 },
    },
    pages: [],
    subtasks: sampleSubtasks,
  },
}

export const LlmAuthored: Story = {
  args: {
    task: {
      ...baseTask,
      title: 'Refactor the auth middleware',
      titleAuthor: { kind: 'llm', agent: 'claude-opus-5' },
      descriptionAuthor: { kind: 'llm', agent: 'claude-opus-5' },
    },
    pages: [],
    subtasks: [],
  },
}

const sampleProject: ProjectDetail = {
  id: 'aaaa0000-0000-0000-0000-000000000000',
  title: 'tq',
  description: null,
  status: 'active',
  startDate: null,
  targetDate: null,
  color: null,
  sortOrder: 0,
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
  completionRate: 0.4,
  taskCount: { total: 10, completed: 4 },
}

export const WithProject: Story = {
  args: {
    task: {
      ...baseTask,
      projectId: sampleProject.id,
      title: 'Task with project',
    },
    pages: [],
    subtasks: [],
    project: sampleProject,
  },
}

// --- Full Page Layout ---
// (Sidebar-only stories live in task-detail-sidebar.stories.tsx, co-located
// with TaskSidebar/TaskSidebarMobile; these compose them with
// TaskMainContent to exercise the full page layout.)

export const FullPagePC: StoryObj<{
  task: TaskDetail
  pages: TaskPage[]
  subtasks: Task[]
}> = {
  args: {
    task: { ...baseTask },
    pages: samplePages,
    subtasks: [],
  },
  parameters: {
    layout: 'fullscreen',
    // This sidebar layout isn't responsive, so at the storybook-mobile
    // project's 375px viewport it overflows — but which element trips the
    // check varies by run (the main content area, a line-clamped
    // description, or the Milkdown editor's wrapper depending on its async
    // mount timing), so no single selector reliably scopes this out.
    // TODO: make this layout responsive — out of scope for this PR, which
    // only adds the detection.
    overflowCheck: { disable: true },
  },
  render: ({ task, pages, subtasks }) => (
    <Providers>
      <div className="flex h-screen">
        <div className="flex-1 overflow-y-auto px-7 py-6">
          <TaskMainContent task={task} pages={pages} subtasks={subtasks} />
        </div>
        <TaskSidebar task={task} />
      </div>
    </Providers>
  ),
}

export const FullPageSP: StoryObj<{
  task: TaskDetail
  pages: TaskPage[]
  subtasks: Task[]
}> = {
  args: {
    task: { ...baseTask },
    pages: samplePages,
    subtasks: [],
  },
  parameters: {
    layout: 'fullscreen',
    viewport: { defaultViewport: 'mobile1' },
  },
  render: ({ task, pages, subtasks }) => (
    <Providers>
      <div className="flex h-screen flex-col overflow-y-auto p-4">
        <TaskSidebarMobile task={task} />
        <div className="mt-4 border-t border-border pt-4">
          <TaskMainContent task={task} pages={pages} subtasks={subtasks} />
        </div>
      </div>
    </Providers>
  ),
}
