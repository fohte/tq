import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { expect, waitFor, within } from 'storybook/test'

import { ProjectUrlChip } from '#components/task/project-url-chip'
import type { ProjectUrlPreview } from '#hooks/use-project-url-preview'
import { projectUrlPreviewKeys } from '#hooks/use-project-url-preview'
import { StoryRouter } from '#storybook-config/story-router'

const PROJECT_ID = 'aaaa0000-0000-0000-0000-000000000000'
const PROJECT_URL =
  'https://tq.fohte.net/projects/aaaa0000-0000-0000-0000-000000000000'
const UNRESOLVED_ID = 'unknown'
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
  context: 'personal',
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

  return (
    <QueryClientProvider client={queryClient}>
      <StoryRouter
        component={() => <>{children}</>}
        paths={['/projects/$projectId']}
      />
    </QueryClientProvider>
  )
}

function ProjectUrlChipWithProviders({
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
      <p className="text-sm">
        See <ProjectUrlChip data={{ id }} raw={raw} /> for details.
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
  args: { id: PROJECT_ID, raw: PROJECT_URL, project: baseProject },
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
    id: PROJECT_ID,
    raw: PROJECT_URL,
    project: { ...baseProject, status: 'paused' },
  },
}

export const Completed: Story = {
  args: {
    id: PROJECT_ID,
    raw: PROJECT_URL,
    project: { ...baseProject, status: 'completed' },
  },
}

// The project preview hasn't resolved yet (or the id doesn't point at an
// actual project): the chip falls back to rendering the raw matched text
// instead of a card.
export const Unresolved: Story = {
  args: { id: UNRESOLVED_ID, raw: UNRESOLVED_URL, project: null },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(UNRESOLVED_URL)).toBeVisible()
  },
}
