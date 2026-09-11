import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import { TemplateRepeatField } from '#components/recurring/template-repeat-field'
import { DetailSidebarPanel } from '#components/ui/detail-sidebar-panel'
import { computeNextOccurrence, type RecurrenceRule } from '#lib/recurrence'
import { formatShortDate } from '#lib/task-due-date'
import { assertDefined } from '#lib/test-utils'

const templateId = '00000000-0000-0000-0000-000000000001'
const anchorDate = '2026-03-20'

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

const meta = {
  title: 'Recurring/TemplateRepeatField',
  component: TemplateRepeatField,
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
} satisfies Meta<typeof TemplateRepeatField>

export default meta
type Story = StoryObj<typeof meta>

export const WeeklySummary: Story = {
  args: {
    templateId,
    recurrenceRule: weeklyRule,
    lastGeneratedDate: null,
    anchorDate,
  },
}

export const OpenEditorShowsNextPreview: Story = {
  args: {
    templateId,
    recurrenceRule: weeklyRule,
    lastGeneratedDate: null,
    anchorDate,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)

    await userEvent.click(canvas.getByText('Weekly · Sun, Wed'))

    // Computed rather than hardcoded so this stays correct regardless of
    // which real date the story runs on (formatShortDate omits the year
    // only when it matches the current year).
    const expectedNext = assertDefined(
      computeNextOccurrence(anchorDate, weeklyRule),
    )
    await body.findByText(`Next: ${formatShortDate(expectedNext)}`)
  },
}

let patchedBody: unknown = null

export const PickDifferentWeekdayAndSave: Story = {
  args: {
    templateId,
    recurrenceRule: weeklyRule,
    lastGeneratedDate: null,
    anchorDate,
  },
  parameters: {
    // recurrenceRule is controlled by the (unchanging) prop, so the
    // closed-state row still reads the original summary after saving.
    screenshot: { skip: true },
    msw: {
      handlers: [
        http.patch('/api/recurring-task-templates/:id', async ({ request }) => {
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
    await userEvent.click(await body.findByText('M'))
    await userEvent.click(await body.findByRole('button', { name: 'Save' }))

    await waitFor(async () => {
      await expect(patchedBody).toEqual({
        recurrenceRule: { type: 'weekly', interval: 1, daysOfWeek: [0, 1, 3] },
      })
    })
  },
}

export const MonthlySummary: Story = {
  args: {
    templateId,
    recurrenceRule: monthlyRule,
    lastGeneratedDate: null,
    anchorDate,
  },
}

export const OpenEditorMonthly: Story = {
  args: {
    templateId,
    recurrenceRule: monthlyRule,
    lastGeneratedDate: null,
    anchorDate,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)

    await userEvent.click(canvas.getByText('Monthly · 15th'))
    await expect(
      await body.findByPlaceholderText('Day of month (1-31)'),
    ).toHaveValue(15)
  },
}
