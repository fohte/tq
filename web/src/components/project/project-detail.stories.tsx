import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import {
  ProjectMainContent,
  ProjectSidebar,
  ProjectSidebarMobile,
} from '@web/components/project/project-detail'
import type { ProjectDetail, ProjectTask } from '@web/hooks/use-projects'
import type { ReactNode } from 'react'

const baseProject: ProjectDetail = {
  id: 'proj-001',
  title: 'ISUCON14',
  description:
    '## Goal\n\nOptimize the ISUCON14 practice benchmark.\n\n- Provision servers\n- Tune database config',
  status: 'active',
  startDate: '2026-06-01',
  targetDate: '2026-08-15',
  color: '#FF8400',
  sortOrder: 0,
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
  completionRate: 0.4,
  taskCount: { total: 5, completed: 2 },
}

const baseTask: Omit<ProjectTask, 'id' | 'title' | 'status'> = {
  description: null,
  context: 'personal',
  startDate: null,
  dueDate: null,
  estimatedMinutes: null,
  parentId: null,
  projectId: 'proj-001',
  sortOrder: 0,
  recurrenceRuleId: null,
  recurrenceRule: null,
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
}

const sampleTasks: ProjectTask[] = [
  {
    ...baseTask,
    id: '1',
    title: 'Provision benchmark servers',
    status: 'completed',
  },
  { ...baseTask, id: '2', title: 'Tune MySQL config', status: 'completed' },
  {
    ...baseTask,
    id: '3',
    title: 'Profile slow queries',
    status: 'in_progress',
  },
  { ...baseTask, id: '4', title: 'Add caching layer', status: 'todo' },
  { ...baseTask, id: '5', title: 'Write final report', status: 'todo' },
]

function Providers({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const rootRoute = createRootRoute({
    component: () => <>{children}</>,
  })
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => null,
  })
  const projectsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/projects',
    component: () => null,
  })
  const projectRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/projects/$projectId',
    component: () => null,
  })
  const projectBoardRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/projects/$projectId/board',
    component: () => null,
  })
  rootRoute.addChildren([
    indexRoute,
    projectsRoute,
    projectRoute,
    projectBoardRoute,
  ])

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

// --- ProjectMainContent Stories ---

function MainContentStory({
  project,
  tasks,
}: {
  project: ProjectDetail
  tasks: ProjectTask[]
}) {
  return (
    <Providers>
      <div className="max-w-2xl p-6">
        <ProjectMainContent project={project} tasks={tasks} />
      </div>
    </Providers>
  )
}

const mainContentMeta = {
  title: 'Project/ProjectDetail/MainContent',
  component: MainContentStory,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof MainContentStory>

export default mainContentMeta
type Story = StoryObj<typeof mainContentMeta>

export const Default: Story = {
  args: {
    project: { ...baseProject },
    tasks: sampleTasks,
  },
}

export const NoDescription: Story = {
  args: {
    project: { ...baseProject, description: null },
    tasks: sampleTasks,
  },
}

export const NoTasks: Story = {
  args: {
    project: {
      ...baseProject,
      completionRate: 0,
      taskCount: { total: 0, completed: 0 },
    },
    tasks: [],
  },
}

export const Completed: Story = {
  args: {
    project: {
      ...baseProject,
      status: 'completed',
      completionRate: 1,
      taskCount: { total: 5, completed: 5 },
    },
    tasks: sampleTasks.map((task) => ({ ...task, status: 'completed' })),
  },
}

// --- ProjectSidebar Stories ---

export const Sidebar: StoryObj<{ project: ProjectDetail }> = {
  args: {
    project: { ...baseProject },
  },
  render: ({ project }) => (
    <Providers>
      <div className="w-60 border-l border-border p-4">
        <ProjectSidebar project={project} />
      </div>
    </Providers>
  ),
}

export const SidebarNoTargetDate: StoryObj<{ project: ProjectDetail }> = {
  args: {
    project: { ...baseProject, targetDate: null },
  },
  render: ({ project }) => (
    <Providers>
      <div className="w-60 border-l border-border p-4">
        <ProjectSidebar project={project} />
      </div>
    </Providers>
  ),
}

// --- ProjectSidebarMobile Stories ---

export const MobileSidebar: StoryObj<{ project: ProjectDetail }> = {
  args: {
    project: { ...baseProject },
  },
  render: ({ project }) => (
    <Providers>
      <div className="max-w-sm border-t border-border p-4">
        <ProjectSidebarMobile project={project} />
      </div>
    </Providers>
  ),
}

// --- Full Page Layout ---

export const FullPagePC: StoryObj<{
  project: ProjectDetail
  tasks: ProjectTask[]
}> = {
  args: {
    project: { ...baseProject },
    tasks: sampleTasks,
  },
  parameters: {
    layout: 'fullscreen',
  },
  render: ({ project, tasks }) => (
    <Providers>
      <div className="flex h-screen">
        <div className="flex-1 overflow-y-auto p-6">
          <ProjectMainContent project={project} tasks={tasks} />
        </div>
        <div className="w-60 shrink-0 overflow-y-auto border-l border-border p-4">
          <ProjectSidebar project={project} />
        </div>
      </div>
    </Providers>
  ),
}

export const FullPageSP: StoryObj<{
  project: ProjectDetail
  tasks: ProjectTask[]
}> = {
  args: {
    project: { ...baseProject },
    tasks: sampleTasks,
  },
  parameters: {
    layout: 'fullscreen',
    viewport: { defaultViewport: 'mobile1' },
  },
  render: ({ project, tasks }) => (
    <Providers>
      <div className="flex h-screen flex-col overflow-y-auto">
        <div className="p-4">
          <ProjectMainContent project={project} tasks={tasks} />
        </div>
        <div className="border-t border-border p-4">
          <ProjectSidebarMobile project={project} />
        </div>
      </div>
    </Providers>
  ),
}
