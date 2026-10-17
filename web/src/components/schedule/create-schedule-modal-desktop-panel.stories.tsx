import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { fn } from 'storybook/test'

import { ScheduleModalDesktopPanel } from '#components/schedule/create-schedule-modal-desktop-panel'
import { scheduleConstraintFormStateFromSaved } from '#components/schedule/schedule-constraints-form-state'
import {
  makeMixedSeverityScheduleConstraintViolations,
  makeSchedule,
  makeScheduleConstraint,
  makeScheduleOverride,
} from '#components/schedule/schedule-test-fixtures'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity } },
})

const meta = {
  title: 'Schedule/CreateScheduleModalDesktopPanel',
  component: ScheduleModalDesktopPanel,
  parameters: {
    layout: 'fullscreen',
    msw: {
      handlers: [
        http.post('/api/schedule/events/:id/constraint-check', () =>
          HttpResponse.json({
            constraintViolations:
              makeMixedSeverityScheduleConstraintViolations(),
          }),
        ),
      ],
    },
  },
  tags: ['desktop-only'],
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <div className="dark min-h-screen bg-background">
          <div className="fixed inset-0 bg-black/40" />
          <Story />
        </div>
      </QueryClientProvider>
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
    isExceptionsError: false,
    onRestoreException: fn(),
    isRestorePending: false,
    remindBeforeMinutes: '',
    setRemindBeforeMinutes: fn(),
    reminderReady: true,
    constraints: null,
    constraintsLoading: false,
    constraintsError: false,
    constraintsSaveError: false,
    scheduleAfterConstraintsSaveError: false,
    constraintsDefaultOpen: false,
    onAddConstraints: fn(),
    onChangeConstraints: fn(),
    onRemoveConstraints: fn(),
    constraintCheckRange: { startDate: '2030-04-15', endDate: '2030-04-21' },
    constraintCheckDraft: undefined,
    constraintCheckDraftInvalid: false,
    isConstraintCheckEnabled: false,
    previewText: null,
    isPreviewLoading: false,
    previewError: false,
    onDelete: fn(),
    isPending: false,
    canSubmit: true,
    handleSubmit: fn(),
  },
} satisfies Meta<typeof ScheduleModalDesktopPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'the desktop panel creates a schedule on the selected date',
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

export const ThisEventWithConstraints: Story = {
  name: 'the editor shows this week while targeting one occurrence',
  args: {
    ...ThisEvent.args,
    schedule: makeSchedule({
      occurrenceDate: '2041-05-15',
      startDate: '2041-05-15',
      start: '2041-05-15T07:00:00',
      end: '2041-05-15T08:00:00',
    }),
    occurrenceDate: '2041-05-15',
    startDate: '2041-05-15',
    startTime: '07:00',
    endTime: '08:00',
    constraints: scheduleConstraintFormStateFromSaved(makeScheduleConstraint()),
    constraintCheckRange: { startDate: '2041-05-13', endDate: '2041-05-19' },
    constraintCheckDraft: { constraints: makeScheduleConstraint() },
    isConstraintCheckEnabled: true,
  },
}

export const ThisEventWithConstraintViolations: Story = {
  name: 'the editor shows constraint violations after skipping an occurrence',
  args: {
    ...ThisEventWithConstraints.args,
    rangeAction: 'skip',
    constraintCheckDraft: {
      occurrenceChange: { originalDate: '2041-05-15', skipped: true },
    },
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

export const ThisEventWithRestore: Story = {
  name: 'the editor can restore an occurrence with an exception',
  args: {
    ...ThisEvent.args,
    schedule: makeSchedule({ overridden: 'time' }),
    canRestoreThisEvent: true,
  },
}

export const AllEventsWithConstraints: Story = {
  name: 'the editor shows saved constraints for all events',
  args: {
    ...ThisEvent.args,
    scope: 'all',
    canEditTitle: true,
    canEditSeriesDetails: true,
    constraints: scheduleConstraintFormStateFromSaved(makeScheduleConstraint()),
  },
}

export const PreviewUnavailable: Story = {
  name: 'the editor explains when a preview could not load',
  args: {
    ...ThisEvent.args,
    previewError: true,
    canSubmit: false,
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
        movedToDate: '2026-01-06',
        skipped: false,
      }),
    ],
    remindBeforeMinutes: 30,
  },
}

export const AllEventsWithReminder: Story = {
  name: 'the editor shows a reminder for all events',
  args: {
    schedule: makeSchedule(),
    scope: 'all',
    canEditTitle: true,
    canEditSeriesDetails: true,
    remindBeforeMinutes: 30,
  },
}
