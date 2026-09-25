import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { makeProjectDetail } from '#components/project/project-test-fixtures'
import { ProjectUrlCard } from '#components/task/project-url-card'
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
  description: 'Personal task manager built with React and Hono.',
  targetDate: '2026-06-01',
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
      <div className="w-full max-w-96">
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
  name: 'the card shows an active project with its task summary',
  args: { id: PROJECT_ID, raw: PROJECT_URL, project: baseProject },
}

export const NoTasksYet: Story = {
  name: 'the card shows a project with no tasks or completion progress',
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
  name: 'the card shows a completed project with all tasks finished',
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
  name: 'the card falls back to the raw project link while details are unresolved',
  args: { id: UNRESOLVED_ID, raw: UNRESOLVED_URL, project: null },
}
