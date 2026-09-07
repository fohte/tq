import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { expect, fn, userEvent } from 'storybook/test'

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

export const Default: Story = {}

export const NestedLabelSelected: Story = {
  args: {
    selectedLabel: 'dev/tq',
  },
}

export const SelectLabel: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: '#chore' }))
    await expect(args.onLabelChange).toHaveBeenCalledWith('chore')
  },
}

export const SelectNestedLabel: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: '#tq' }))
    await expect(args.onLabelChange).toHaveBeenCalledWith('dev/tq')
  },
}

// "dev" has no Label of its own — it's synthesized purely to group "dev/tq"
// and "dev/infra" — but still filters to its descendants when selected.
export const SelectSynthesizedParentLabel: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: '#dev' }))
    await expect(args.onLabelChange).toHaveBeenCalledWith('dev')
  },
}

export const ClearLabel: Story = {
  args: {
    selectedLabel: 'dev/tq',
  },
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'No label' }))
    await expect(args.onLabelChange).toHaveBeenCalledWith(undefined)
  },
}
