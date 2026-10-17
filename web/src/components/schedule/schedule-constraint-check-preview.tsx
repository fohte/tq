import { ScheduleConstraintCheckResult } from '#components/schedule/schedule-constraint-check-result'
import { useDebounce } from '#hooks/use-debounce'
import {
  type ScheduleConstraintCheckDraft,
  type ScheduleConstraintCheckInput,
  useScheduleConstraintCheck,
} from '#hooks/use-schedules'

interface ScheduleConstraintCheckPreviewProps {
  scheduleId: string
  range: Pick<ScheduleConstraintCheckInput, 'startDate' | 'endDate'>
  draft: ScheduleConstraintCheckDraft | undefined
  enabled: boolean
  draftInvalid: boolean
}

export function ScheduleConstraintCheckPreview({
  scheduleId,
  range,
  draft,
  enabled,
  draftInvalid,
}: ScheduleConstraintCheckPreviewProps) {
  const input: ScheduleConstraintCheckInput = {
    ...range,
    ...(draft == null ? {} : { draft }),
  }
  const inputKey = JSON.stringify(input)
  const debouncedInputKey = useDebounce(inputKey, 300)
  const isDebouncing = !draftInvalid && inputKey !== debouncedInputKey
  const check = useScheduleConstraintCheck(
    scheduleId,
    input,
    enabled && !draftInvalid && !isDebouncing,
  )

  return (
    <ScheduleConstraintCheckResult
      startDate={range.startDate}
      endDate={range.endDate}
      constraintViolations={check.data?.constraintViolations ?? []}
      isLoading={isDebouncing || check.isFetching}
      isError={check.isError}
      isIncomplete={Boolean(
        check.data?.calendarDataIncomplete ||
        check.data?.constraintEvaluationIncomplete,
      )}
      draftInvalid={draftInvalid}
    />
  )
}
