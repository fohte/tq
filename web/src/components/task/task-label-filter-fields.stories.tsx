import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { expect, fn, userEvent } from 'storybook/test'

import { TaskLabelFilterFields } from '#components/task/task-label-filter-fields'
import { labelKeys } from '#hooks/use-labels'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity } },
})
queryClient.setQueryData(labelKeys.all, [
  {
    id: '1',
    name: 'dev:tq',
    color: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: '2',
    name: 'chore',
    color: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
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

export const Default: Story = {}

export const LabelSelected: Story = {
  args: {
    selectedLabel: 'dev:tq',
  },
}

export const SelectLabel: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: '#chore' }))
    await expect(args.onLabelChange).toHaveBeenCalledWith('chore')
  },
}

export const ClearLabel: Story = {
  args: {
    selectedLabel: 'dev:tq',
  },
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'No label' }))
    await expect(args.onLabelChange).toHaveBeenCalledWith(undefined)
  },
}
