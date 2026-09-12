import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { expect, within } from 'storybook/test'

import { RecurringTemplateMainContent } from '#components/recurring/recurring-template-detail-main'
import { makeRecurringTemplate } from '#components/recurring/recurring-template-test-fixtures'
import { makeTask } from '#components/task/task-row-test-fixtures'
import type { RecurringTemplate } from '#hooks/use-recurring-templates'
import { assertDefined } from '#lib/test-utils'
import { StoryRouter } from '#storybook-config/story-router'

const baseTemplate = makeRecurringTemplate({
  id: 'template-001',
  title: 'Write weekly report',
  description: 'Summarize progress and blockers for the team.',
  recurrenceRule: {
    id: 'rule-001',
    type: 'weekly',
    interval: 1,
    daysOfWeek: [1],
    dayOfMonth: null,
  },
  labels: ['report'],
  context: 'work',
  anchorDate: '2026-03-20',
})

function Providers({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <StoryRouter
        component={() => <>{children}</>}
        paths={['/tasks', '/recurring', '/tasks/$taskId']}
      />
    </QueryClientProvider>
  )
}

function MainContentStory({ template }: { template: RecurringTemplate }) {
  return (
    <Providers>
      <div className="max-w-2xl p-6">
        <RecurringTemplateMainContent template={template} />
      </div>
    </Providers>
  )
}

const meta = {
  title: 'Recurring/RecurringTemplateDetail/MainContent',
  component: MainContentStory,
  parameters: {
    layout: 'fullscreen',
    msw: {
      handlers: [http.get('/api/tasks', () => HttpResponse.json([]))],
    },
  },
} satisfies Meta<typeof MainContentStory>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    template: { ...baseTemplate },
  },
}

export const NoLabelsOrDescription: Story = {
  args: {
    template: { ...baseTemplate, labels: [], description: null },
  },
}

export const WithGeneratedTasks: Story = {
  args: {
    template: { ...baseTemplate },
  },
  parameters: {
    msw: {
      handlers: [
        http.get('/api/tasks', () =>
          HttpResponse.json([
            makeTask({
              id: 'task-1',
              number: 5,
              title: 'Write weekly report — week 1',
              status: 'completed',
              startDate: '2026-03-09',
              dueDate: '2026-03-13',
              templateId: baseTemplate.id,
            }),
          ]),
        ),
      ],
    },
  },
}

export const OpenDeleteDialog: Story = {
  args: {
    template: { ...baseTemplate },
  },
  play: async ({ canvasElement, userEvent }) => {
    const trigger = assertDefined(
      canvasElement.querySelector<HTMLElement>(
        '[data-slot="dropdown-menu-trigger"]',
      ),
      'desktop trigger not found',
    )
    await userEvent.click(trigger)

    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(await body.findByText('delete…'))

    await expect(await body.findByText('Delete template')).toBeInTheDocument()
  },
}
