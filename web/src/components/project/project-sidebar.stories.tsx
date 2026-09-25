import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { ProjectSidebar } from '#components/project/project-detail-sidebar'
import { makeProjectDetail } from '#components/project/project-test-fixtures'
import type { ProjectDetail } from '#hooks/use-projects'
import { StoryRouter } from '#storybook-config/story-router'

const baseProject = makeProjectDetail({
  id: 'proj-001',
  title: 'ISUCON14',
  description:
    '## Goal\n\nOptimize the ISUCON14 practice benchmark.\n\n- Provision servers\n- Tune database config',
  startDate: '2026-06-01',
  targetDate: '2026-08-15',
  color: '#FF8400',
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
  completionRate: 0.4,
  taskCount: { total: 5, completed: 2 },
})

function Providers({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <StoryRouter component={() => <>{children}</>} />
    </QueryClientProvider>
  )
}

function ProjectSidebarStory({ project }: { project: ProjectDetail }) {
  return (
    <Providers>
      <ProjectSidebar project={project} />
    </Providers>
  )
}

const meta = {
  title: 'Project/ProjectDetail/Sidebar',
  component: ProjectSidebarStory,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof ProjectSidebarStory>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'the project sidebar shows its description, dates, and actions',
  args: {
    project: { ...baseProject },
  },
}

export const NoTargetDate: Story = {
  name: 'the project sidebar omits a target date that is not set',
  args: {
    project: { ...baseProject, targetDate: null },
  },
}

export const WorkContext: Story = {
  name: 'the project sidebar marks the project as work related',
  args: {
    project: { ...baseProject, context: 'work' },
  },
}
