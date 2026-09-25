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

export const WeeklySummary: Story = {
  name: 'the repeat field summarizes a weekly schedule',
}

export const OpenEditorShowsNextPreview: Story = {
  name: 'the open weekly editor previews the next scheduled occurrence',
  args: {
    isEditing: true,
  },
}

export const MonthlySummary: Story = {
  name: 'the repeat field summarizes a monthly schedule',
  args: {
    recurrenceRule: monthlyRule,
    type: 'monthly',
    dayOfMonth: '15',
  },
}

export const OpenEditorMonthly: Story = {
  name: 'the open monthly editor shows its repeat settings and next occurrence',
  args: {
    recurrenceRule: monthlyRule,
    isEditing: true,
    type: 'monthly',
    dayOfMonth: '15',
  },
}
