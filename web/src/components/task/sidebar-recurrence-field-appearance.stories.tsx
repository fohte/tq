import type { Meta, StoryObj } from '@storybook/react-vite'

import { SidebarRecurrenceFieldAppearance } from '#components/task/sidebar-recurrence-field'
import { DetailSidebarPanel } from '#components/ui/detail-sidebar-panel'
import type { RecurrenceRule } from '#lib/recurrence'
import { StoryRouter } from '#storybook-config/story-router'

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
  title: 'Task/TaskDetail/SidebarRecurrenceFieldAppearance',
  component: SidebarRecurrenceFieldAppearance,
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
    templateId: null,
    recurrenceRule: null,
    isEditing: false,
    onOpenChange: () => {},
    type: '',
    onTypeChange: () => {},
    intervalInput: '1',
    onIntervalInputChange: () => {},
    daysOfWeek: [],
    onToggleDay: () => {},
    dayOfMonth: '',
    onDayOfMonthChange: () => {},
    shorthandInput: '',
    onShorthandInputChange: () => {},
    dueDate,
    canSave: false,
    onSave: () => {},
  },
} satisfies Meta<typeof SidebarRecurrenceFieldAppearance>

export default meta
type Story = StoryObj<typeof meta>

export const NoRule: Story = {
  name: 'the recurrence field has no schedule set',
}

export const WeeklySummary: Story = {
  name: 'the recurrence field summarizes a weekly schedule',
  args: {
    recurrenceRule: weeklyRule,
  },
}

export const MonthlySummary: Story = {
  name: 'the recurrence field summarizes a monthly schedule',
  args: {
    recurrenceRule: monthlyRule,
  },
}

export const OpenEditor: Story = {
  name: 'the recurrence editor is open with weekly options selected',
  args: {
    recurrenceRule: weeklyRule,
    isEditing: true,
    type: 'weekly',
    daysOfWeek: [0, 3],
  },
}

export const SaveDisabledWithoutChanges: Story = {
  name: 'the editor keeps saving disabled until the unsupported rule changes',
  args: {
    // A 'custom' rule (only reachable via the API/MCP, never created by
    // this UI) has no matching Select option, so opening the editor starts
    // the draft at 'None' with nothing else changed — Save must stay
    // disabled rather than silently clearing the custom rule on one click.
    recurrenceRule: customRule,
    isEditing: true,
    type: '',
    canSave: false,
  },
}

export const GeneratedFromTemplate: Story = {
  name: 'the recurrence field shows a weekly schedule from a template',
  args: {
    recurrenceRule: weeklyRule,
    templateId: '00000000-0000-0000-0000-000000000002',
  },
  decorators: [
    (Story) => (
      <StoryRouter
        paths={['/recurring/$templateId']}
        component={() => <Story />}
      />
    ),
  ],
}
