import type { Meta, StoryObj } from '@storybook/react-vite'

import { TemplateRepeatFieldAppearance } from '#components/recurring/template-repeat-field'
import { DetailSidebarPanel } from '#components/ui/detail-sidebar-panel'
import type { RecurrenceRule } from '#lib/recurrence'

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
  title: 'Recurring/TemplateRepeatFieldAppearance',
  component: TemplateRepeatFieldAppearance,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <div className="flex h-64">
        <DetailSidebarPanel>
          <Story />
        </DetailSidebarPanel>
      </div>
    ),
  ],
  args: {
    recurrenceRule: weeklyRule,
    isEditing: false,
    onOpenChange: () => {},
    type: 'weekly',
    onTypeChange: () => {},
    intervalInput: '1',
    onIntervalInputChange: () => {},
    daysOfWeek: [0, 3],
    onToggleDay: () => {},
    dayOfMonth: '',
    onDayOfMonthChange: () => {},
    anchorDate,
    lastGeneratedDate: null,
    canSave: false,
    onSave: () => {},
  },
} satisfies Meta<typeof TemplateRepeatFieldAppearance>

export default meta
type Story = StoryObj<typeof meta>

export const WeeklySummary: Story = {}

export const OpenEditorShowsNextPreview: Story = {
  args: {
    isEditing: true,
  },
}

export const MonthlySummary: Story = {
  args: {
    recurrenceRule: monthlyRule,
    type: 'monthly',
    dayOfMonth: '15',
  },
}

export const OpenEditorMonthly: Story = {
  args: {
    recurrenceRule: monthlyRule,
    isEditing: true,
    type: 'monthly',
    dayOfMonth: '15',
  },
}
