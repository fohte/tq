import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import { SidebarRemindField } from '#components/task/sidebar-remind-field'
import { formatAbsoluteReminder, parseReminderInput } from '#lib/reminder-input'
import { assertDefined } from '#lib/test-utils'

const taskId = '00000000-0000-0000-0000-000000000001'

// Kept relative to `Date.now()` (not a fixed ISO literal) so the "今日"/"明日"
// label this renders stays correct no matter which day this story runs
// (see SessionRow's `baseSession` for the same pattern).
function atOffsetDays(days: number, hours: number, minutes: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  date.setHours(hours, minutes, 0, 0)
  return date.toISOString()
}

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
    // Far enough in the past to never collide with "今日"/"明日".
    remindAt: '2026-03-25T09:00:00.000Z',
  },
}

export const TomorrowReminder: Story = {
  args: {
    taskId,
    remindAt: atOffsetDays(1, 9, 0),
  },
}

export const Editing: Story = {
  args: {
    taskId,
    remindAt: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)

    await userEvent.click(canvas.getByText('なし'))
    await canvas.findByPlaceholderText('明日9時 など')

    // Empty input shows the fixed presets, not an interpretation.
    await body.findByText('1時間後')
    await body.findByText('今日18:00')
    await body.findByText('明日09:00')
    await body.findByText('来週月曜09:00')
  },
}

export const TypeAndInterpret: Story = {
  args: {
    taskId,
    remindAt: null,
  },
  parameters: {
    // The interpreted row's exact text depends on the real "now" the story
    // runs at (chrono resolves "来週月曜10時" relative to it).
    screenshot: { skip: true },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)

    await userEvent.click(canvas.getByText('なし'))
    const input = await canvas.findByPlaceholderText('明日9時 など')
    await userEvent.type(input, '来週月曜10時')

    const expectedDate = assertDefined(await parseReminderInput('来週月曜10時'))
    // The typed text itself is never shown as the result — only the
    // absolute datetime chrono resolved it to.
    await body.findByText(formatAbsoluteReminder(expectedDate))
    await expect(body.queryByText('来週月曜10時')).toBeNull()
  },
}

export const UnrecognizedInput: Story = {
  args: {
    taskId,
    remindAt: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)

    await userEvent.click(canvas.getByText('なし'))
    const input = await canvas.findByPlaceholderText('明日9時 など')
    await userEvent.type(input, 'あいうえお')

    await body.findByText('解釈できません')

    // An unparseable input must never confirm — Enter is a no-op.
    await userEvent.keyboard('{Enter}')
    await body.findByText('解釈できません')
  },
}

let patchedBody: unknown = null

export const SelectPreset: Story = {
  args: {
    taskId,
    remindAt: null,
  },
  parameters: {
    // The field's own value is driven by the (unchanging) `remindAt` prop,
    // so the closed-state row still reads "なし" after selecting a preset.
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
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)

    await userEvent.click(canvas.getByText('なし'))
    await userEvent.click(await body.findByText('今日18:00'))

    const expectedDate = assertDefined(await parseReminderInput('今日18:00'))
    await waitFor(async () => {
      await expect(patchedBody).toEqual({
        remindAt: expectedDate.toISOString(),
      })
    })
  },
}

export const TypeAndConfirm: Story = {
  args: {
    taskId,
    remindAt: null,
  },
  parameters: {
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
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByText('なし'))
    const input = await canvas.findByPlaceholderText('明日9時 など')
    await userEvent.type(input, '明日9時')

    const expectedDate = assertDefined(await parseReminderInput('明日9時'))
    await userEvent.keyboard('{Enter}')

    await waitFor(async () => {
      await expect(patchedBody).toEqual({
        remindAt: expectedDate.toISOString(),
      })
    })
  },
}

const clearReminderAt = '2026-03-25T09:00:00.000Z'

export const ClearReminder: Story = {
  args: {
    taskId,
    remindAt: clearReminderAt,
  },
  parameters: {
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
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)

    // Rendered in the runner's local timezone, so compute the expected text
    // rather than hardcoding it.
    await userEvent.click(
      canvas.getByText(formatAbsoluteReminder(new Date(clearReminderAt))),
    )
    await userEvent.click(await body.findByText('なし'))

    await waitFor(async () => {
      await expect(patchedBody).toEqual({ remindAt: null })
    })
  },
}
