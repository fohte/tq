import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { fn } from 'storybook/test'

import { KanbanFilterRow } from '#components/day-view/kanban-filter-row'
import { makeProject } from '#components/project/project-test-fixtures'
import type { Project } from '#hooks/use-projects'
import { taskKeys } from '#hooks/use-task-queries'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity } },
})
queryClient.setQueryData(taskKeys.detail('parent-example'), {
  id: 'parent-example',
  title: 'Plan the release',
})

const project: Project = makeProject({
  id: 'project-example',
  title: 'Sample project',
})

const meta = {
  title: 'DayView/KanbanFilterRow',
  component: KanbanFilterRow,
  parameters: {
    msw: {
      handlers: [
        http.get('/api/tasks/search/suggest', () => HttpResponse.json([])),
        http.get('/api/labels', () => HttpResponse.json([])),
      ],
    },
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  args: {
    onQueryChange: fn(),
    query:
      'project:project-example label:sample-label has:pages parent:parent-example',
    projects: [project],
  },
} satisfies Meta<typeof KanbanFilterRow>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'shows a kanban filter row with its search query',
}

export const SearchHelpOpen: Story = {
  name: 'the search syntax help is open',
  args: {
    query: '',
    defaultOpenSearchHelp: true,
  },
}
