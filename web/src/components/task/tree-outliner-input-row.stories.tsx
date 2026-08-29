import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, fn, within } from 'storybook/test'

import { TreeOutlinerInputRow } from '#components/task/tree-outliner-input-row'
import { emptyLabelsHandler, emptyTasksHandler } from '#lib/msw-test-handlers'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

const meta = {
  title: 'Task/TreeOutlinerInputRow',
  component: TreeOutlinerInputRow,
  parameters: {
    layout: 'centered',
    // CreateTaskInline (rendered unconditionally inside this row) always
    // fetches labels on mount.
    msw: {
      handlers: [emptyLabelsHandler],
    },
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <div className="w-full max-w-96">
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
  args: {
    depth: 0,
    parentId: null,
    parentNumber: null,
    inherited: undefined,
    onClose: fn(),
    onIndent: fn(),
    onOutdent: fn(),
  },
} satisfies Meta<typeof TreeOutlinerInputRow>

export default meta
type Story = StoryObj<typeof meta>

export const TopLevel: Story = {}

export const NestedChild: Story = {
  args: {
    depth: 2,
    parentId: '00000000-0000-0000-0000-000000000001',
    parentNumber: 12,
    inherited: { context: 'work', projectId: null, labels: ['dev:tq'] },
  },
  parameters: {
    // A non-null parentId additionally makes useExistingTaskLink fetch the
    // full task list, so this overrides the meta handlers rather than
    // extending them.
    msw: {
      handlers: [emptyLabelsHandler, emptyTasksHandler],
    },
  },
}

export const IndentsOnTab: Story = {
  play: async ({ canvasElement, args, userEvent }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByPlaceholderText(/New task/i)

    await userEvent.type(input, 'Sub task')
    await userEvent.tab()

    await expect(args.onIndent).toHaveBeenCalledTimes(1)
    await expect(args.onOutdent).not.toHaveBeenCalled()
  },
}

export const OutdentsOnShiftTab: Story = {
  play: async ({ canvasElement, args, userEvent }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByPlaceholderText(/New task/i)

    await userEvent.type(input, 'Sub task')
    await userEvent.tab({ shift: true })

    await expect(args.onOutdent).toHaveBeenCalledTimes(1)
    await expect(args.onIndent).not.toHaveBeenCalled()
  },
}

export const ClosesOnEscape: Story = {
  play: async ({ canvasElement, args, userEvent }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByPlaceholderText(/New task/i)

    await userEvent.type(input, 'Sub task')
    await userEvent.keyboard('{Escape}')

    await expect(args.onClose).toHaveBeenCalledTimes(1)
  },
}
