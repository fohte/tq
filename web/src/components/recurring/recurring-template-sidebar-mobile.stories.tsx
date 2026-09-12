import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { RecurringTemplateSidebarMobile } from '#components/recurring/recurring-template-detail-sidebar'
import { makeRecurringTemplate } from '#components/recurring/recurring-template-test-fixtures'
import type { RecurringTemplate } from '#hooks/use-recurring-templates'
import { StoryRouter } from '#storybook-config/story-router'

const baseTemplate = makeRecurringTemplate({
  id: 'template-001',
  title: 'Write weekly report',
  recurrenceRule: {
    id: 'rule-001',
    type: 'weekly',
    interval: 1,
    daysOfWeek: [1],
    dayOfMonth: null,
  },
  estimatedMinutes: 30,
  context: 'work',
  labels: ['report'],
  startOffsetDays: 1,
  anchorDate: '2026-03-20',
})

function Providers({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <StoryRouter component={() => <>{children}</>} />
    </QueryClientProvider>
  )
}

function RecurringTemplateSidebarMobileStory({
  template,
}: {
  template: RecurringTemplate
}) {
  return (
    <Providers>
      <div className="max-w-sm border-t border-border p-4">
        <RecurringTemplateSidebarMobile template={template} />
      </div>
    </Providers>
  )
}

const meta = {
  title: 'Recurring/RecurringTemplateDetail/SidebarMobile',
  component: RecurringTemplateSidebarMobileStory,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof RecurringTemplateSidebarMobileStory>

export default meta
type Story = StoryObj<typeof meta>

export const Active: Story = {
  args: {
    template: { ...baseTemplate },
  },
}

export const Paused: Story = {
  args: {
    template: { ...baseTemplate, enabled: false },
  },
}
