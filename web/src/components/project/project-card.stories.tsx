import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { ProjectCard } from '@web/components/project/project-card'

function ProjectCardStory(props: React.ComponentProps<typeof ProjectCard>) {
  const rootRoute = createRootRoute({
    component: () => (
      <div className="dark max-w-sm bg-background p-4">
        <ProjectCard {...props} />
      </div>
    ),
  })
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => null,
  })
  rootRoute.addChildren([indexRoute])
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  return <RouterProvider router={router} />
}

const meta = {
  title: 'Project/ProjectCard',
  component: ProjectCardStory,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof ProjectCardStory>

export default meta
type Story = StoryObj<typeof meta>

export const Active: Story = {
  args: {
    project: {
      id: '1',
      title: 'ISUCON14',
      description: 'Preparation for ISUCON14 competition',
      status: 'active',
      startDate: '2024-11-01',
      targetDate: '2024-12-08',
      color: '#FF5C33',
      sortOrder: 0,
      createdAt: '2024-10-01T00:00:00Z',
      updatedAt: '2024-10-01T00:00:00Z',
    },
  },
}

export const Paused: Story = {
  args: {
    project: {
      id: '2',
      title: 'RubyKaigi 2025',
      description: 'Talk preparation and demo setup',
      status: 'paused',
      startDate: null,
      targetDate: null,
      color: '#4A90D9',
      sortOrder: 1,
      createdAt: '2024-10-01T00:00:00Z',
      updatedAt: '2024-10-01T00:00:00Z',
    },
  },
}

export const Completed: Story = {
  args: {
    project: {
      id: '3',
      title: 'Completed Project',
      description: null,
      status: 'completed',
      startDate: '2024-06-01',
      targetDate: '2024-09-30',
      color: '#4CAF50',
      sortOrder: 2,
      createdAt: '2024-06-01T00:00:00Z',
      updatedAt: '2024-09-30T00:00:00Z',
    },
  },
}

export const NoDescription: Story = {
  args: {
    project: {
      id: '4',
      title: 'Minimal Project',
      description: null,
      status: 'active',
      startDate: null,
      targetDate: null,
      color: '#9B59B6',
      sortOrder: 3,
      createdAt: '2024-10-01T00:00:00Z',
      updatedAt: '2024-10-01T00:00:00Z',
    },
  },
}
