import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CreateTaskModal } from '@web/components/task/create-task-modal'
import { expect, fn, within } from 'storybook/test'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

const meta = {
  title: 'Task/CreateTaskModal',
  component: CreateTaskModal,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <div className="dark h-screen bg-background">
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
  args: {
    open: true,
    onOpenChange: fn(),
  },
} satisfies Meta<typeof CreateTaskModal>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement, userEvent }) => {
    // Modal renders via portal, so query the entire document body
    const body = within(canvasElement.ownerDocument.body)

    // Renders the modal title when open
    // Base-UI renders duplicate elements; check that at least one is visible
    const titles = body.getAllByText('New Task')
    await expect(titles.length).toBeGreaterThan(0)

    // Create button is disabled when title is empty
    // Base-UI duplicates buttons too; find visible ones
    const createButtons = body.getAllByRole('button', { name: /create/i })
    for (const btn of createButtons) {
      await expect(btn).toBeDisabled()
    }

    // Enables create button after entering a title
    const titleInputs =
      body.getAllByPlaceholderText(/task title|タスクのタイトル/i)
    const titleInput = titleInputs[0]
    if (titleInput == null) throw new Error('Title input not found')
    await userEvent.type(titleInput, 'Test task')

    const enabledButton = body
      .getAllByRole('button', { name: /create/i })
      .find((btn) => !btn.hasAttribute('disabled'))
    await expect(enabledButton).toBeDefined()
  },
}

export const WithDefaultStartDate: Story = {
  args: {
    defaultStartDate: new Date().toISOString().slice(0, 10),
  },
}

const longDescription = [
  '## Why',
  '',
  'This is a very long description to test scrolling behavior.',
  '',
  '## What',
  '',
  ...Array.from(
    { length: 30 },
    (_, i) => `- Task item ${String(i + 1)}: do something important`,
  ),
  '',
  '## Notes',
  '',
  ...Array.from(
    { length: 10 },
    (_, i) =>
      `Paragraph ${String(i + 1)}: Lorem ipsum dolor sit amet, consectetur adipiscing elit.`,
  ),
].join('\n')

export const LongDescription: Story = {
  args: {
    defaultDescription: longDescription,
    defaultStartDate: new Date().toISOString().slice(0, 10),
  },
}
