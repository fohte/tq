import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { ScheduleModalMobilePanel } from '#components/schedule/create-schedule-modal-mobile-panel'
import {
  makeSchedule,
  makeScheduleOverride,
} from '#components/schedule/schedule-test-fixtures'

const meta = {
  title: 'Schedule/CreateScheduleModalMobilePanel',
  component: ScheduleModalMobilePanel,
  parameters: {
    layout: 'fullscreen',
    overflowCheck: { ignoreSelectors: ['.overflow-x-auto'] },
  },
  tags: ['mobile-only'],
  decorators: [
    (Story) => (
      <div className="dark min-h-screen bg-background">
        <div className="fixed inset-0 bg-black/40" />
        <Story />
      </div>
    ),
  ],
  args: {
    schedule: undefined,
    handleOpenChange: fn(),
    scope: 'all',
    setScope: fn(),
    occurrenceDate: '2030-04-17',
    rangeAction: null,
    setRangeAction: fn(),
    canRestoreThisEvent: false,
    canEditTitle: true,
    canEditSeriesDetails: true,
    title: 'Sample schedule',
    setTitle: fn(),
    startDate: '2030-04-17',
    setStartDate: fn(),
    startTime: '08:30',
    setStartTime: fn(),
    endTime: '09:00',
    setEndTime: fn(),
    recurrenceType: '',
    setRecurrenceType: fn(),
    daysOfWeek: [],
    toggleDay: fn(),
    dayOfMonth: '',
    setDayOfMonth: fn(),
    context: '',
    setContext: fn(),
    color: '',
    setColor: fn(),
    exceptions: [],
    isExceptionsLoading: false,
    onRestoreException: fn(),
    isRestorePending: false,
    remindBeforeMinutes: '',
    setRemindBeforeMinutes: fn(),
    reminderReady: true,
    previewText: null,
    isPreviewLoading: false,
    previewError: false,
    onDelete: fn(),
    isPending: false,
    canSubmit: true,
    handleSubmit: fn(),
  },
} satisfies Meta<typeof ScheduleModalMobilePanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'the mobile panel shows the selected start date',
}

export const ThisEvent: Story = {
  name: 'the editor targets one occurrence',
  args: {
    schedule: makeSchedule(),
    scope: 'this',
    canEditTitle: false,
    canEditSeriesDetails: false,
    startDate: '2026-01-01',
    startTime: '07:00',
    endTime: '08:00',
    occurrenceDate: '2026-01-01',
  },
}

export const ThisEventPreview: Story = {
  name: 'the editor previews a skipped occurrence',
  args: {
    ...ThisEvent.args,
    rangeAction: 'skip',
    previewText: 'Skips this event on Thu, Jan 1. Other events are unchanged.',
  },
}

export const PreviewUnavailable: Story = {
  name: 'the editor explains when a preview could not load',
  args: {
    ...ThisEvent.args,
    previewError: true,
  },
}

export const ThisAndFollowing: Story = {
  name: 'the editor changes this and following occurrences',
  args: {
    schedule: makeSchedule(),
    scope: 'following',
    canEditTitle: false,
    canEditSeriesDetails: true,
    startDate: '2026-01-03',
    startTime: '08:30',
    endTime: '09:30',
    occurrenceDate: '2026-01-03',
    recurrenceType: 'weekly',
    daysOfWeek: [1, 3, 5],
  },
}

export const ThisAndFollowingPreview: Story = {
  name: 'the editor previews changes to following occurrences',
  args: {
    ...ThisAndFollowing.args,
    rangeAction: 'endSeries',
    previewText:
      'From Sat, Jan 3: 3 occurrences will change. Earlier events are unchanged. 1 exception will be removed.',
  },
}

export const AllEventsWithExceptions: Story = {
  name: 'the editor lists and restores exceptions for all events',
  args: {
    schedule: makeSchedule(),
    scope: 'all',
    canEditTitle: true,
    canEditSeriesDetails: true,
    exceptions: [
      makeScheduleOverride({ occurrenceDate: '2026-01-03', skipped: true }),
      makeScheduleOverride({
        occurrenceDate: '2026-01-05',
        startTime: '08:00',
        endTime: '09:00',
        movedToDate: '2026-01-06',
        skipped: false,
      }),
    ],
    remindBeforeMinutes: 30,
  },
}
