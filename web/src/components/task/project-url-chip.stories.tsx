import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { makeProjectDetail } from '#components/project/project-test-fixtures'
import { ProjectUrlChip } from '#components/task/project-url-chip'
import type { ProjectUrlPreview } from '#hooks/use-project-url-preview'
import { projectUrlPreviewKeys } from '#hooks/use-project-url-preview'
import { StoryRouter } from '#storybook-config/story-router'

const PROJECT_ID = 'aaaa0000-0000-0000-0000-000000000000'
const PROJECT_URL =
  'https://tq.fohte.net/projects/aaaa0000-0000-0000-0000-000000000000'
const UNRESOLVED_ID = 'unknown'
const UNRESOLVED_URL = 'https://tq.fohte.net/projects/unknown'

const baseProject: ProjectUrlPreview = makeProjectDetail({
  id: 'aaaa0000-0000-0000-0000-000000000000',
  description: 'Personal task manager',
  completionRate: 0.4,
  taskCount: { total: 10, completed: 4 },
})

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
  defaultOpen,
}: {
  id: string
  raw: string
  project: ProjectUrlPreview | null
  defaultOpen?: boolean | undefined
}) {
  return (
    <Providers id={id} project={project}>
      <p className="text-sm">
        See <ProjectUrlChip data={{ id }} raw={raw} defaultOpen={defaultOpen} />{' '}
        for details.
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
  name: 'the chip opens a preview card for an active project',
  args: {
    id: PROJECT_ID,
    raw: PROJECT_URL,
    project: baseProject,
    defaultOpen: true,
  },
}

export const Paused: Story = {
  name: 'the chip marks a paused project inline',
  args: {
    id: PROJECT_ID,
    raw: PROJECT_URL,
    project: { ...baseProject, status: 'paused' },
  },
}

export const Completed: Story = {
  name: 'the chip marks a completed project inline',
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
  name: 'the chip falls back to the raw project link while details are unresolved',
  args: { id: UNRESOLVED_ID, raw: UNRESOLVED_URL, project: null },
}
