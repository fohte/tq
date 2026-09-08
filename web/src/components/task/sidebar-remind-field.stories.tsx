import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { expect, fireEvent, waitFor } from 'storybook/test'

import { SidebarRemindField } from '#components/task/sidebar-remind-field'
import { assertDefined } from '#lib/test-utils'

const taskId = '00000000-0000-0000-0000-000000000001'

const meta = {
  title: 'Task/TaskDetail/SidebarRemindField',
  component: SidebarRemindField,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <div className="relative w-56 border-l border-border p-4">
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
} satisfies Meta<typeof SidebarRemindField>

export default meta
type Story = StoryObj<typeof meta>

export const NoReminder: Story = {
  args: {
    taskId,
    remindAt: null,
  },
}

export const WithReminder: Story = {
  args: {
    taskId,
    remindAt: '2026-03-25T09:00:00.000Z',
  },
}

// The input is controlled by the `remindAt` prop, which this story never
// updates — the PATCH body is what proves the local wall-clock time the user
// picked is sent as the matching instant.
let patchedBody: unknown = null

export const SetReminder: Story = {
  args: {
    taskId,
    remindAt: null,
  },
  parameters: {
    // Identical to NoReminder: the controlled input still reads null after
    // the edit.
    screenshot: { skip: true },
    msw: {
      handlers: [
        http.patch('/api/tasks/:id', async ({ request }) => {
          patchedBody = await request.json()
          return HttpResponse.json({})
        }),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    patchedBody = null
    const input = assertDefined(canvasElement.querySelector('input'))

    // `userEvent.type` would have to walk the browser's own segmented
    // date/time editor; setting the value is what the component reacts to.
    await fireEvent.change(input, { target: { value: '2026-03-25T09:00' } })

    await waitFor(async () => {
      await expect(patchedBody).toEqual({
        remindAt: new Date('2026-03-25T09:00').toISOString(),
      })
    })
  },
}
