import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ParsedQuery } from 'api/search-query-parser'
import { http, HttpResponse } from 'msw'
import { expect, fn, userEvent } from 'storybook/test'

import { TaskFilterMenuContent } from '#components/task/task-filter-menu-content'
import type { Project } from '#hooks/use-projects'
import { StoryRouter } from '#storybook-config/story-router'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

const emptyLabelsHandler = http.get('/api/labels', () => HttpResponse.json([]))

const projectA: Project = {
  id: 'proj-1',
  title: 'Website Redesign',
  description: null,
  status: 'active',
  startDate: null,
  targetDate: null,
  color: null,
  sortOrder: 0,
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
  taskCount: { total: 0, completed: 0 },
  completionRate: 0,
}

const projectB: Project = {
  ...projectA,
  id: 'proj-2',
  title: 'Mobile App',
}

const projects = [projectA, projectB]

const defaultParsed: ParsedQuery = {
  freeText: '',
  status: ['todo', 'in_progress'],
  sortBy: 'updated',
}

const meta = {
  title: 'Task/TaskFilterMenuContent',
  component: TaskFilterMenuContent,
  parameters: {
    layout: 'centered',
    msw: { handlers: [emptyLabelsHandler] },
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <div className="flex w-64 flex-col gap-5 p-4">
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
  args: {
    parsed: defaultParsed,
    onQueryChange: fn(),
    projects,
    showContext: false,
  },
} satisfies Meta<typeof TaskFilterMenuContent>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

// Rendered directly (not behind FilterMenu's useIsDesktop), so this is the
// only place the mobile-only CONTEXT section gets VRT coverage.
export const WithContext: Story = {
  args: {
    showContext: true,
  },
  render: (args) => (
    <StoryRouter component={() => <TaskFilterMenuContent {...args} />} />
  ),
}

export const ProjectSelected: Story = {
  args: {
    parsed: { ...defaultParsed, projectId: 'proj-1' },
  },
}

export const NoProjects: Story = {
  args: {
    projects: [],
  },
}

export const CheckCompleted: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('checkbox', { name: 'Completed' }))
    await expect(args.onQueryChange).toHaveBeenCalledWith(
      'is:todo is:in_progress is:completed sort:updated',
    )
  },
}

export const SelectProject: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Mobile App' }))
    await expect(args.onQueryChange).toHaveBeenCalledWith(
      'is:todo is:in_progress project:proj-2 sort:updated',
    )
  },
}
