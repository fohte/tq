import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { expect, fn, waitFor, within } from 'storybook/test'

import { DeleteRecurringTemplateDialog } from '#components/recurring/delete-recurring-template-dialog'

const meta = {
  title: 'Recurring/DeleteRecurringTemplateDialog',
  component: DeleteRecurringTemplateDialog,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: false, staleTime: Infinity } },
          })
        }
      >
        <Story />
      </QueryClientProvider>
    ),
  ],
  args: {
    open: true,
    onOpenChange: fn(),
    templateId: '00000000-0000-0000-0000-000000000001',
    templateTitle: 'Write weekly report',
  },
} satisfies Meta<typeof DeleteRecurringTemplateDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await expect(await body.findByText('Delete template')).toBeInTheDocument()
    await expect(
      await body.findByText(/Tasks it already generated are kept/),
    ).toBeInTheDocument()
  },
}

export const LongTitle: Story = {
  args: {
    templateTitle:
      'Send a weekly summary of ISUCON14 practice benchmark progress to the team channel',
  },
}

export const Confirmed: Story = {
  args: {
    onDeleted: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.delete('/api/recurring-task-templates/:id', () =>
          HttpResponse.json({}),
        ),
      ],
    },
    // This dialog stays mounted throughout (`open` is a static arg here, so
    // `onOpenChange` never actually closes it) — same rationale as
    // delete-task-dialog.stories.tsx's Confirmed story.
    screenshot: { skip: true },
  },
  play: async ({ canvasElement, userEvent, args }) => {
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(await body.findByRole('button', { name: 'Delete' }))

    await waitFor(async () => {
      await expect(args.onDeleted).toHaveBeenCalled()
    })
  },
}
