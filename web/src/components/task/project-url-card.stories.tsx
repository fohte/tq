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
import { expect } from 'storybook/test'

import { ProjectUrlCard } from '#components/task/project-url-card'
import type { ProjectUrlPreview } from '#hooks/use-project-url-preview'
import { projectUrlPreviewKeys } from '#hooks/use-project-url-preview'

const PROJECT_ID = 'aaaa0000-0000-0000-0000-000000000000'
const PROJECT_URL =
  'https://tq.fohte.net/projects/aaaa0000-0000-0000-0000-000000000000'
const UNRESOLVED_ID = 'unknown'
const UNRESOLVED_URL = 'https://tq.fohte.net/projects/unknown'

const baseProject: ProjectUrlPreview = {
  id: 'aaaa0000-0000-0000-0000-000000000000',
  title: 'tq',
  description: 'Personal task manager built with React and Hono.',
  status: 'active',
  startDate: null,
  targetDate: '2026-06-01',
  color: null,
  sortOrder: 0,
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
  completionRate: 0.4,
  taskCount: { total: 10, completed: 4 },
}

function Providers({
  id,
  project,
  children,
}: {
  id: string
  project: ProjectUrlPreview | null
  children: ReactNode
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  queryClient.setQueryData(projectUrlPreviewKeys.preview(id), project)

  const rootRoute = createRootRoute({
    component: () => <>{children}</>,
  })
  const projectRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/projects/$projectId',
    component: () => null,
  })
  rootRoute.addChildren([projectRoute])
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

function ProjectUrlCardWithProviders({
  id,
  raw,
  project,
}: {
  id: string
  raw: string
  project: ProjectUrlPreview | null
}) {
  return (
    <Providers id={id} project={project}>
      <div className="w-96">
        <ProjectUrlCard data={{ id }} raw={raw} />
      </div>
    </Providers>
  )
}

const meta = {
  title: 'Task/ProjectUrlCard',
  component: ProjectUrlCardWithProviders,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof ProjectUrlCardWithProviders>

export default meta
type Story = StoryObj<typeof meta>

export const Active: Story = {
  args: { id: PROJECT_ID, raw: PROJECT_URL, project: baseProject },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(baseProject.title)).toBeVisible()
    await expect(canvas.getByText(baseProject.description ?? '')).toBeVisible()
  },
}

export const NoTasksYet: Story = {
  args: {
    id: PROJECT_ID,
    raw: PROJECT_URL,
    project: {
      ...baseProject,
      completionRate: 0,
      taskCount: { total: 0, completed: 0 },
    },
  },
}

export const Completed: Story = {
  args: {
    id: PROJECT_ID,
    raw: PROJECT_URL,
    project: {
      ...baseProject,
      status: 'completed',
      completionRate: 1,
      taskCount: { total: 10, completed: 10 },
    },
  },
}

// The project preview hasn't resolved yet (or the id doesn't point at an
// actual project): the card falls back to rendering the raw matched text
// while its data is unresolved.
export const Unresolved: Story = {
  args: { id: UNRESOLVED_ID, raw: UNRESOLVED_URL, project: null },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(UNRESOLVED_URL)).toBeVisible()
  },
}
