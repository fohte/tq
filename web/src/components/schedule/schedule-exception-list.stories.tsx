import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { ScheduleExceptionList } from '#components/schedule/schedule-exception-list'
import { makeScheduleOverride } from '#components/schedule/schedule-test-fixtures'

const meta = {
  title: 'Schedule/ScheduleExceptionList',
  component: ScheduleExceptionList,
  args: {
    exceptions: [],
    isLoading: false,
    isError: false,
    onRestore: fn(),
    isRestorePending: false,
  },
} satisfies Meta<typeof ScheduleExceptionList>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  name: 'the exception list has no entries',
}

export const Loading: Story = {
  name: 'the exception list is loading',
  args: { isLoading: true },
}

export const Unavailable: Story = {
  name: 'the exception list explains when it could not load',
  args: { isError: true },
}

export const MixedExceptions: Story = {
  name: 'the exception list shows moved, changed, and skipped events',
  args: {
    exceptions: [
      makeScheduleOverride({
        occurrenceDate: '2030-04-18',
        movedToDate: '2030-04-19',
        skipped: false,
      }),
      makeScheduleOverride({ occurrenceDate: '2030-04-20', skipped: false }),
      makeScheduleOverride({ occurrenceDate: '2030-04-21', skipped: true }),
    ],
  },
}
