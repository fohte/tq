import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { ScheduleEditScopeSelector } from '#components/schedule/schedule-edit-scope-selector'

const meta = {
  title: 'Schedule/ScheduleEditScopeSelector',
  component: ScheduleEditScopeSelector,
  args: { setScope: fn(), reminderReady: true },
} satisfies Meta<typeof ScheduleEditScopeSelector>

export default meta
type Story = StoryObj<typeof meta>

export const ThisEvent: Story = {
  name: 'the selector applies changes to one event',
  args: { scope: 'this' },
}

export const ThisAndFollowing: Story = {
  name: 'the selector applies changes from this event forward',
  args: { scope: 'following' },
}

export const AllEvents: Story = {
  name: 'the selector applies changes to all events',
  args: { scope: 'all' },
}
