import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { fn } from 'storybook/test'

import { makeLabel } from '#components/label/label-test-fixtures'
import { TaskLabelFilterFields } from '#components/task/task-label-filter-fields'
import { labelKeys } from '#hooks/use-labels'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity } },
})
queryClient.setQueryData(labelKeys.list({ context: 'personal' }), [
  makeLabel({ id: '1', name: 'dev/tq' }),
  makeLabel({ id: '2', name: 'dev/infra' }),
  makeLabel({ id: '3', name: 'chore' }),
])

const meta = {
  title: 'Task/TaskLabelFilterFields',
  component: TaskLabelFilterFields,
  parameters: {
    layout: 'centered',
    msw: { handlers: [http.get('/api/labels', () => HttpResponse.json([]))] },
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <div className="w-64 p-4">
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
  args: {
    selectedLabel: undefined,
    onLabelChange: fn(),
  },
} satisfies Meta<typeof TaskLabelFilterFields>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'no label is selected in the filter fields.',
}

export const NestedLabelSelected: Story = {
  name: 'a nested label is selected in the filter fields.',
  args: {
    selectedLabel: 'dev/tq',
  },
}
