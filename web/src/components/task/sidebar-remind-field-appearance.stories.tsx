import type { Meta, StoryObj } from '@storybook/react-vite'

import { SidebarRemindFieldAppearance } from '#components/task/sidebar-remind-field'
import { formatReminderSummary } from '#lib/reminder-input'

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
  title: 'Task/TaskDetail/SidebarRemindFieldAppearance',
  component: SidebarRemindFieldAppearance,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div className="relative w-56 border-l border-border p-4">
        <Story />
      </div>
    ),
  ],
  args: {
    remindAtLabel: 'なし',
    isEditing: false,
    onOpenChange: () => {},
    query: '',
    onQueryChange: () => {},
    parsedDate: null,
    onClear: () => {},
    onSelectPreset: () => {},
    onCommit: () => {},
  },
} satisfies Meta<typeof SidebarRemindFieldAppearance>

export default meta
type Story = StoryObj<typeof meta>

export const NoReminder: Story = {}

export const WithReminder: Story = {
  args: {
    // Far enough in the past to never collide with "今日"/"明日".
    remindAtLabel: formatReminderSummary(new Date('2026-03-25T09:00:00.000Z')),
  },
}

export const TomorrowReminder: Story = {
  args: {
    remindAtLabel: formatReminderSummary(new Date(atOffsetDays(1, 9, 0))),
  },
}

export const Editing: Story = {
  args: {
    isEditing: true,
    query: '',
    parsedDate: null,
  },
}

export const TypeAndInterpret: Story = {
  args: {
    isEditing: true,
    query: '来週月曜10時',
    // Fixed, not derived from `Date.now()` — chrono resolving the query
    // above happens once in production, not on every render of this story.
    parsedDate: new Date(2026, 8, 21, 10, 0, 0),
  },
}

export const UnrecognizedInput: Story = {
  args: {
    isEditing: true,
    query: 'あいうえお',
    parsedDate: null,
  },
}
