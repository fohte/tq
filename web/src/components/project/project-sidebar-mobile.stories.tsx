import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { ProjectSidebarMobile } from '#components/project/project-detail-sidebar'
import type { ProjectDetail } from '#hooks/use-projects'
import { StoryRouter } from '#storybook-config/story-router'

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
  context: 'personal',
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
  completionRate: 0.4,
  taskCount: { total: 5, completed: 2 },
}

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

function ProjectSidebarMobileStory({ project }: { project: ProjectDetail }) {
  return (
    <Providers>
      <div className="max-w-sm border-t border-border p-4">
        <ProjectSidebarMobile project={project} />
      </div>
    </Providers>
  )
}

const meta = {
  title: 'Project/ProjectDetail/SidebarMobile',
  component: ProjectSidebarMobileStory,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof ProjectSidebarMobileStory>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    project: { ...baseProject },
  },
}

export const WorkContext: Story = {
  args: {
    project: { ...baseProject, context: 'work' },
  },
}
