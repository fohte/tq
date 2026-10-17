import type { ScheduleConstraintFormState } from '#components/schedule/schedule-constraints-form-state'
import type {
  ScheduleEditAction,
  ScheduleEditScope,
} from '#components/schedule/schedule-edit-dialog-state'
import type {
  ContextValue,
  RecurrenceType,
} from '#components/schedule/schedule-modal-form-options'
import type { Schedule, ScheduleOverride } from '#hooks/use-schedules'

export interface SchedulePanelProps {
  schedule: Schedule | undefined
  handleOpenChange: (open: boolean) => void
  scope: ScheduleEditScope
  setScope: (scope: ScheduleEditScope) => void
  occurrenceDate: string
  rangeAction: ScheduleEditAction
  setRangeAction: (action: ScheduleEditAction) => void
  canRestoreThisEvent: boolean
  canEditTitle: boolean
  canEditSeriesDetails: boolean
  title: string
  setTitle: (value: string) => void
  startTime: string
  setStartTime: (value: string) => void
  startDate: string
  setStartDate: (value: string) => void
  endTime: string
  setEndTime: (value: string) => void
  recurrenceType: RecurrenceType | ''
  setRecurrenceType: (value: RecurrenceType | '') => void
  daysOfWeek: number[]
  toggleDay: (day: number) => void
  dayOfMonth: string
  setDayOfMonth: (value: string) => void
  context: ContextValue | ''
  setContext: (value: ContextValue | '') => void
  color: string
  setColor: (value: string) => void
  exceptions: ScheduleOverride[]
  isExceptionsLoading: boolean
  isExceptionsError: boolean
  onRestoreException: (occurrenceDate: string) => void
  isRestorePending: boolean
  remindBeforeMinutes: number | ''
  setRemindBeforeMinutes: (value: number | '') => void
  reminderReady: boolean
  constraints: ScheduleConstraintFormState | null
  constraintsLoading: boolean
  constraintsError: boolean
  constraintsSaveError: boolean
  scheduleAfterConstraintsSaveError: boolean
  constraintsDefaultOpen: boolean
  onAddConstraints: () => void
  onChangeConstraints: (value: ScheduleConstraintFormState) => void
  onRemoveConstraints: () => void
  previewText: string | null
  isPreviewLoading: boolean
  previewError: boolean
  onDelete: () => void
  isPending: boolean
  canSubmit: boolean
  handleSubmit: () => void
}
