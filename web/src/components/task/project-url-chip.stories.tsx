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
import { expect, waitFor, within } from 'storybook/test'

import { ProjectUrlChip } from '#components/task/project-url-chip'
import type { ProjectUrlPreview } from '#hooks/use-project-url-preview'
import { projectUrlPreviewKeys } from '#hooks/use-project-url-preview'

const PROJECT_URL =
  'https://tq.fohte.net/projects/aaaa0000-0000-0000-0000-000000000000'
const UNRESOLVED_URL = 'https://tq.fohte.net/projects/unknown'

const baseProject: ProjectUrlPreview = {
  id: 'aaaa0000-0000-0000-0000-000000000000',
  title: 'tq',
  description: 'Personal task manager',
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

function Providers({
  url,
  project,
  children,
}: {
  url: string
  project: ProjectUrlPreview | null
  children: ReactNode
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  queryClient.setQueryData(projectUrlPreviewKeys.preview(url), project)

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

function ProjectUrlChipWithProviders({
  url,
  raw,
  project,
}: {
  url: string
  raw: string
  project: ProjectUrlPreview | null
}) {
  return (
    <Providers url={url} project={project}>
      <p className="text-sm">
        See <ProjectUrlChip data={{ url }} raw={raw} /> for details.
      </p>
    </Providers>
  )
}

const meta = {
  title: 'Task/ProjectUrlChip',
  component: ProjectUrlChipWithProviders,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof ProjectUrlChipWithProviders>

export default meta
type Story = StoryObj<typeof meta>

export const Active: Story = {
  args: { url: PROJECT_URL, raw: PROJECT_URL, project: baseProject },
  play: async ({ canvas, canvasElement, userEvent }) => {
    // The chip renders as a portal into the app's own React tree in
    // production (see plugin.tsx), so this exercises the same tree shape:
    // hovering must open the preview card without throwing. The popup
    // renders via a portal, so it must be queried against the document body.
    await userEvent.hover(canvas.getByText(baseProject.title))
    const body = within(canvasElement.ownerDocument.body)
    // The popup's fade-in animation can still be mid-transition right as the
    // text mounts, so wait for it to finish rather than checking visibility
    // the instant the text appears.
    await waitFor(() =>
      expect(body.getByText(baseProject.description ?? '')).toBeVisible(),
    )
  },
}

export const Paused: Story = {
  args: {
    url: PROJECT_URL,
    raw: PROJECT_URL,
    project: { ...baseProject, status: 'paused' },
  },
}

export const Completed: Story = {
  args: {
    url: PROJECT_URL,
    raw: PROJECT_URL,
    project: { ...baseProject, status: 'completed' },
  },
}

// The project preview hasn't resolved yet (or the URL doesn't point at an
// actual project): the chip falls back to rendering the raw matched text
// instead of a card.
export const Unresolved: Story = {
  args: { url: UNRESOLVED_URL, raw: UNRESOLVED_URL, project: null },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(UNRESOLVED_URL)).toBeVisible()
  },
}
