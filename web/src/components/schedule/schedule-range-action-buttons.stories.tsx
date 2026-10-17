import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { ScheduleRangeActionButtons } from '#components/schedule/schedule-range-action-buttons'

const meta = {
  title: 'Schedule/ScheduleRangeActionButtons',
  component: ScheduleRangeActionButtons,
  args: { action: null, canRestore: false, setAction: fn() },
} satisfies Meta<typeof ScheduleRangeActionButtons>

export default meta
type Story = StoryObj<typeof meta>

export const ThisEvent: Story = {
  name: 'the controls can skip one event',
  args: { scope: 'this' },
}

export const RestoreAvailable: Story = {
  name: 'the controls can restore an exception',
  args: { scope: 'this', canRestore: true, action: 'restore' },
}

export const Following: Story = {
  name: 'the controls can end a series at this date',
  args: { scope: 'following' },
}
