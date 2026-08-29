import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { expect, fn, waitFor, within } from 'storybook/test'

import { CreateTaskModal } from '#components/task/create-task-modal'
import { atIndex } from '#lib/test-utils'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

const meta = {
  title: 'Task/CreateTaskModal',
  component: CreateTaskModal,
  parameters: {
    layout: 'fullscreen',
    msw: {
      handlers: [
        http.get('/api/labels', () => HttpResponse.json([])),
        http.post('/api/tasks', () =>
          HttpResponse.json({
            id: 'temp-id',
            number: 1,
            title: 'temp',
            description: null,
            status: 'todo',
            context: 'personal',
            labels: [],
          }),
        ),
      ],
    },
    // The chip row (start/due date, tags, ...) is an intentional horizontal
    // scroll area (`overflow-x-auto`); which stories trip it at the
    // storybook-mobile project's 375px viewport depends on exact chip
    // content width.
    overflowCheck: { ignoreSelectors: ['.overflow-x-auto'] },
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
    // The dialog content mounts into the portal asynchronously
    const titles = await body.findAllByText('New Task')
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
    const titleInput = atIndex(titleInputs, 0)
    await userEvent.type(titleInput, 'Test task')

    const enabledButton = body
      .getAllByRole('button', { name: /create/i })
      .find((btn) => !btn.hasAttribute('disabled'))
    await expect(enabledButton).toBeDefined()
  },
}

export const AddsTag: Story = {
  play: async ({ canvasElement, userEvent }) => {
    const body = within(canvasElement.ownerDocument.body)

    const addTagButtons = await body.findAllByRole('button', {
      name: '+ add tag',
    })
    const addTagButton = atIndex(addTagButtons, 0)
    await userEvent.click(addTagButton)

    const tagInputs = body.getAllByPlaceholderText('tag name')
    const tagInput = atIndex(tagInputs, 0)
    await userEvent.type(tagInput, 'urgent')
    await userEvent.keyboard('{Enter}')

    await expect(body.getAllByText('urgent').length).toBeGreaterThan(0)
  },
}

export const EscapeInTagInputDoesNotCloseModal: Story = {
  play: async ({ canvasElement, userEvent, args }) => {
    const body = within(canvasElement.ownerDocument.body)

    const addTagButtons = await body.findAllByRole('button', {
      name: '+ add tag',
    })
    const addTagButton = atIndex(addTagButtons, 0)
    await userEvent.click(addTagButton)

    const tagInputs = body.getAllByPlaceholderText('tag name')
    const tagInput = atIndex(tagInputs, 0)
    await userEvent.type(tagInput, 'urgent')
    await userEvent.keyboard('{Escape}')

    // The tag input closes on Escape, but the event must not bubble up to
    // the Dialog and close the whole modal (and discard the in-progress task).
    await expect(
      body.queryByPlaceholderText('tag name'),
    ).not.toBeInTheDocument()
    await expect(args.onOpenChange).not.toHaveBeenCalled()
  },
}

export const SubmitsOnCmdEnterFromTitle: Story = {
  play: async ({ canvasElement, userEvent, args }) => {
    const body = within(canvasElement.ownerDocument.body)
    const titleInputs =
      body.getAllByPlaceholderText(/task title|タスクのタイトル/i)
    const titleInput = atIndex(titleInputs, 0)
    await userEvent.type(titleInput, 'Cmd enter from title')
    await userEvent.keyboard('{Meta>}{Enter}{/Meta}')

    // The create mutation resolves asynchronously before onOpenChange(false) fires.
    await waitFor(async () => {
      await expect(args.onOpenChange).toHaveBeenCalledWith(false)
    })
  },
}

export const SubmitsOnCmdEnterFromDescription: Story = {
  play: async ({ canvasElement, userEvent, args }) => {
    const body = within(canvasElement.ownerDocument.body)
    const titleInputs =
      body.getAllByPlaceholderText(/task title|タスクのタイトル/i)
    const titleInput = atIndex(titleInputs, 0)
    await userEvent.type(titleInput, 'Cmd enter from description')

    const editors = Array.from(
      canvasElement.ownerDocument.body.querySelectorAll(
        '[contenteditable="true"]',
      ),
    )
    const editor = atIndex(editors, 0)
    await userEvent.click(editor)
    await userEvent.keyboard('some description text')
    await userEvent.keyboard('{Meta>}{Enter}{/Meta}')

    await waitFor(async () => {
      await expect(args.onOpenChange).toHaveBeenCalledWith(false)
    })
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
