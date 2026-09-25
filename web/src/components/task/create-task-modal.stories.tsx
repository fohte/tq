import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { fn } from 'storybook/test'

import { CreateTaskModal } from '#components/task/create-task-modal'

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
        // Typing `^N` triggers TaskTitleInput's own suggestion menu (see
        // task-title-input.stories.tsx) in addition to the parent-preview
        // lookup these stories care about; an empty list keeps that menu out
        // of the way.
        http.get('/api/tasks/mentions', () => HttpResponse.json([])),
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
  name: 'opens an empty task creation form',
}

export const WithDefaultStartDate: Story = {
  name: 'prefills the task start date',
  args: {
    defaultStartDate: new Date().toISOString().slice(0, 10),
  },
}

export const WithDefaultEstimate: Story = {
  name: 'prefills the task estimate',
  args: {
    defaultEstimateMinutes: 90,
  },
}

export const DiscardConfirmation: Story = {
  name: 'asks for confirmation before discarding the draft',
  args: {
    defaultDiscardConfirmationOpen: true,
  },
}

export const AsSubtask: Story = {
  name: 'creates a subtask under the selected parent',
  args: {
    parentId: 'parent-task-id',
    parentTaskNumber: 12,
    parentTaskTitle: 'Fix login bug',
    defaultContext: 'work',
    defaultLabels: ['dev:tq'],
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
  name: 'opens the editor with a long description and start date',
  args: {
    defaultDescription: longDescription,
    defaultStartDate: new Date().toISOString().slice(0, 10),
  },
}
