import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import { SidebarRecurrenceField } from '#components/task/sidebar-recurrence-field'
import { DetailSidebarPanel } from '#components/ui/detail-sidebar-panel'
import { computeNextOccurrence, type RecurrenceRule } from '#lib/recurrence'
import { formatShortDate } from '#lib/task-due-date'
import { assertDefined, clickSelectOption } from '#lib/test-utils'

const taskId = '00000000-0000-0000-0000-000000000001'
const dueDate = '2026-03-25'

const weeklyRule: RecurrenceRule = {
  type: 'weekly',
  interval: 1,
  daysOfWeek: [0, 3],
}

const monthlyRule: RecurrenceRule = {
  type: 'monthly',
  interval: 1,
  dayOfMonth: 15,
}

const customRule: RecurrenceRule = {
  type: 'custom',
  interval: 3,
}

const meta = {
  title: 'Task/TaskDetail/SidebarRecurrenceField',
  component: SidebarRecurrenceField,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <div className="flex h-64">
          <DetailSidebarPanel>
            <Story />
          </DetailSidebarPanel>
        </div>
      </QueryClientProvider>
    ),
  ],
} satisfies Meta<typeof SidebarRecurrenceField>

export default meta
type Story = StoryObj<typeof meta>

export const NoRule: Story = {
  args: {
    taskId,
    dueDate,
    recurrenceRule: null,
  },
}

export const WeeklySummary: Story = {
  args: {
    taskId,
    dueDate,
    recurrenceRule: weeklyRule,
  },
}

export const MonthlySummary: Story = {
  args: {
    taskId,
    dueDate,
    recurrenceRule: monthlyRule,
  },
}

export const OpenEditor: Story = {
  args: {
    taskId,
    dueDate,
    recurrenceRule: weeklyRule,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)

    await userEvent.click(canvas.getByText('Weekly · Sun, Wed'))

    // Computed rather than hardcoded so this stays correct regardless of
    // which real date the story runs on (formatShortDate omits the year
    // only when it matches the current year).
    const expectedNext = assertDefined(
      computeNextOccurrence(dueDate, weeklyRule),
    )
    await body.findByText(`Next: ${formatShortDate(expectedNext)}`)

    await userEvent.click(await body.findByRole('combobox'))
    await expect(
      await body.findByRole('option', { name: 'Weekly' }),
    ).toHaveAttribute('aria-selected', 'true')
  },
}

export const SaveDisabledWithoutChanges: Story = {
  args: {
    taskId,
    dueDate,
    recurrenceRule: customRule,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)

    // A 'custom' rule (only reachable via the API/MCP, never created by
    // this UI) has no matching Select option, so opening the editor starts
    // the draft at 'None' with nothing else changed. Regression test for a
    // bug where Save was enabled immediately in this state, silently
    // clearing the custom rule on a single click.
    await userEvent.click(canvas.getByText('Custom · every 3 days'))
    await expect(
      await body.findByRole('button', { name: 'Save' }),
    ).toBeDisabled()
  },
}

let patchedBody: unknown = null

export const PickWeeklyAndSave: Story = {
  args: {
    taskId,
    dueDate,
    recurrenceRule: null,
  },
  parameters: {
    // recurrenceRule is controlled by the (unchanging) prop, so the
    // closed-state row still reads "—" after saving.
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

    await userEvent.click(canvas.getByText('—'))
    await userEvent.click(await body.findByRole('combobox'))
    await clickSelectOption(
      userEvent,
      await body.findByRole('option', { name: 'Weekly' }),
    )
    await userEvent.click(await body.findByText('W'))
    await userEvent.click(await body.findByRole('button', { name: 'Save' }))

    await waitFor(async () => {
      await expect(patchedBody).toEqual({
        recurrenceRule: { type: 'weekly', interval: 1, daysOfWeek: [3] },
      })
    })
  },
}

export const PickMonthlyAndSave: Story = {
  args: {
    taskId,
    dueDate,
    recurrenceRule: null,
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

    await userEvent.click(canvas.getByText('—'))
    await userEvent.click(await body.findByRole('combobox'))
    await clickSelectOption(
      userEvent,
      await body.findByRole('option', { name: 'Monthly' }),
    )
    const dayInput = await body.findByPlaceholderText('Day of month (1-31)')
    await userEvent.type(dayInput, '10')
    await userEvent.click(await body.findByRole('button', { name: 'Save' }))

    await waitFor(async () => {
      await expect(patchedBody).toEqual({
        recurrenceRule: { type: 'monthly', interval: 1, dayOfMonth: 10 },
      })
    })
  },
}

export const TypeShorthandAndSave: Story = {
  args: {
    taskId,
    dueDate,
    recurrenceRule: null,
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

    await userEvent.click(canvas.getByText('—'))
    const shorthandInput = await body.findByPlaceholderText(
      '*weekly, *sun, *毎週 ...',
    )
    await userEvent.type(shorthandInput, '*sun')
    await userEvent.click(await body.findByRole('button', { name: 'Save' }))

    await waitFor(async () => {
      await expect(patchedBody).toEqual({
        recurrenceRule: { type: 'weekly', interval: 1, daysOfWeek: [0] },
      })
    })
  },
}

export const ClearRecurrence: Story = {
  args: {
    taskId,
    dueDate,
    recurrenceRule: weeklyRule,
  },
  parameters: {
    // recurrenceRule is controlled by the (unchanging) prop, so the
    // closed-state row still reads the original summary after saving.
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

    await userEvent.click(canvas.getByText('Weekly · Sun, Wed'))
    await userEvent.click(await body.findByRole('combobox'))
    await clickSelectOption(
      userEvent,
      await body.findByRole('option', { name: 'None' }),
    )
    await userEvent.click(await body.findByRole('button', { name: 'Save' }))

    await waitFor(async () => {
      await expect(patchedBody).toEqual({ recurrenceRule: null })
    })
  },
}
