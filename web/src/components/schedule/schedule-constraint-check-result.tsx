import { CalendarDays, CircleCheck, CircleX, TriangleAlert } from 'lucide-react'

import { dayLabels } from '#components/schedule/schedule-modal-form-options'
import type { ScheduleConstraintCheckResponse } from '#hooks/use-schedules'
import { cn } from '#lib/utils'

type ScheduleConstraintViolation =
  ScheduleConstraintCheckResponse['constraintViolations'][number]

interface ScheduleConstraintCheckResultProps {
  startDate: string
  endDate: string
  constraintViolations: ScheduleConstraintViolation[]
  isLoading: boolean
  isError: boolean
  isIncomplete: boolean
  draftInvalid: boolean
}

export function ScheduleConstraintCheckResult({
  startDate,
  endDate,
  constraintViolations,
  isLoading,
  isError,
  isIncomplete,
  draftInvalid,
}: ScheduleConstraintCheckResultProps) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex items-center gap-1 font-mono text-2xs tracking-widest text-muted-foreground-faint">
        <CalendarDays className="size-3.5" />
        This week · {formatDateRangeLabel(startDate, endDate)}
      </h3>

      {draftInvalid ? (
        <p role="status" className="text-xs text-muted-foreground">
          Complete valid constraints to check this week.
        </p>
      ) : isLoading ? (
        <p role="status" className="text-xs text-muted-foreground">
          Checking this week…
        </p>
      ) : isError ? (
        <p role="alert" className="text-xs text-destructive">
          This week’s constraints could not be checked.
        </p>
      ) : constraintViolations.length === 0 ? (
        <div
          role="status"
          className={cn(
            'flex items-center gap-2 rounded-md border border-tint-green bg-tint-green px-2.5 py-2 text-xs text-tint-green-foreground',
            isIncomplete && 'border-border bg-surface text-muted-foreground',
          )}
        >
          <CircleCheck className="size-3.5 shrink-0" />
          {isIncomplete
            ? 'Some constraints could not be checked.'
            : 'All constraints met'}
        </div>
      ) : (
        <div
          role="list"
          aria-label="Constraint violations"
          className="flex flex-col gap-1.5"
        >
          {constraintViolations.map((violation, index) => (
            <ViolationRow
              key={`${violation.type}-${violation.date}-${String(index)}`}
              violation={violation}
            />
          ))}
          {isIncomplete && (
            <p role="status" className="text-xs text-muted-foreground">
              Some constraints could not be checked.
            </p>
          )}
        </div>
      )}
    </section>
  )
}

function ViolationRow({
  violation,
}: {
  violation: ScheduleConstraintViolation
}) {
  const isRequired = violation.severity === 'required'
  const Icon = isRequired ? CircleX : TriangleAlert

  return (
    <div
      role="listitem"
      className={cn(
        'flex min-w-0 items-center gap-2 rounded-md border px-2.5 py-2 text-xs',
        isRequired
          ? 'border-tint-red bg-tint-red text-tint-red-foreground'
          : 'border-tint-yellow bg-tint-yellow text-tint-yellow-foreground',
      )}
    >
      <Icon className="size-3.5 shrink-0" />
      <span className="min-w-0 flex-1">{formatViolation(violation)}</span>{' '}
      <span className="shrink-0 font-mono text-2xs tracking-widest">
        {isRequired ? 'REQUIRED' : 'PREFERRED'}
      </span>
    </div>
  )
}

function formatViolation(violation: ScheduleConstraintViolation): string {
  switch (violation.type) {
    case 'weekly-count-below-minimum':
      return `${String(violation.count)} of min ${String(violation.minimum)} this week`
    case 'weekly-count-above-maximum':
      return `${String(violation.count)} of max ${String(violation.maximum)} this week`
    case 'weekly-target-not-met':
      return `${String(violation.count)} of target ${String(violation.target)} this week`
    case 'excluded-weekday':
      return `${weekdayName(violation.date)} is set to Never${
        violation.originalDate == null
          ? ''
          : ` (moved from ${weekdayName(violation.originalDate)})`
      }`
    case 'reserve-weekday':
      return `Uses backup day: ${weekdayName(violation.date)}`
    case 'consecutive-days-exceeded':
      return `${String(violation.consecutiveDays)} days in a row: ${violation.dates
        .map(weekdayName)
        .join(', ')}`
    case 'outside-time-window':
      return `${violation.startTime}–${violation.endTime} is outside ${violation.windowStart}–${violation.windowEnd}`
    case 'if-free-overlap':
      return `${weekdayName(violation.date)} overlaps another event (${violation.overlap.startTime}–${violation.overlap.endTime})`
  }
}

function weekdayName(date: string): string {
  const dayOfWeek = new Date(`${date}T00:00:00`).getDay()
  return dayLabels[dayOfWeek] ?? ''
}

function formatDateRangeLabel(startDate: string, endDate: string): string {
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short' })
  const startMonth = monthFormatter.format(start)
  const endMonth = monthFormatter.format(end)
  const startDay = start.getDate()
  const endDay = end.getDate()

  return startMonth === endMonth
    ? `${startMonth} ${String(startDay)} – ${String(endDay)}`
    : `${startMonth} ${String(startDay)} – ${endMonth} ${String(endDay)}`
}
