import { Button } from '@fohte/ui/button'
import { Input } from '@fohte/ui/input'
import { Clock, Plus, SlidersHorizontal, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import type { ScheduleConstraintFormState } from '#components/schedule/schedule-constraints-form-state'
import {
  cycleScheduleConstraintWeekdayPreference,
  scheduleConstraintFormStateError,
  scheduleConstraintSummary,
} from '#components/schedule/schedule-constraints-form-state'
import { InlineFieldGroup } from '#components/ui/modal-field'
import { cn } from '#lib/utils'

const weekdays = [
  { dayOfWeek: 0, label: 'S', name: 'Sunday' },
  { dayOfWeek: 1, label: 'M', name: 'Monday' },
  { dayOfWeek: 2, label: 'T', name: 'Tuesday' },
  { dayOfWeek: 3, label: 'W', name: 'Wednesday' },
  { dayOfWeek: 4, label: 'T', name: 'Thursday' },
  { dayOfWeek: 5, label: 'F', name: 'Friday' },
  { dayOfWeek: 6, label: 'S', name: 'Saturday' },
] as const

const preferenceLabels = {
  preferred: 'OK',
  if_free: 'If free',
  reserve: 'Backup',
  excluded: 'Never',
} as const

const preferenceCellLabels = {
  preferred: 'OK',
  if_free: 'IF FREE',
  reserve: 'BACKUP',
  excluded: 'NEVER',
} as const

const preferenceClasses = {
  preferred: 'border-border-strong bg-surface-strong text-foreground',
  if_free: 'border-border bg-tint-blue text-tint-blue-foreground',
  reserve: 'border-border bg-tint-yellow text-tint-yellow-foreground',
  excluded: 'border-border bg-tint-red text-tint-red-foreground',
} as const

interface ScheduleConstraintsFieldProps {
  variant: 'desktop' | 'mobile'
  value: ScheduleConstraintFormState | null
  isLoading: boolean
  isError: boolean
  saveError: boolean
  scheduleAfterConstraintsSaveError: boolean
  isPending: boolean
  defaultOpen?: boolean
  onAdd: () => void
  onChange: (value: ScheduleConstraintFormState) => void
  onRemove: () => void
}

export function ScheduleConstraintsField({
  variant,
  value,
  isLoading,
  isError,
  saveError,
  scheduleAfterConstraintsSaveError,
  isPending,
  defaultOpen = false,
  onAdd,
  onChange,
  onRemove,
}: ScheduleConstraintsFieldProps) {
  const [isExpanded, setIsExpanded] = useState(defaultOpen)

  useEffect(() => {
    setIsExpanded(defaultOpen)
  }, [defaultOpen])

  if (isLoading) {
    return (
      <>
        <ConstraintsSaveErrors
          saveError={saveError}
          scheduleAfterConstraintsSaveError={scheduleAfterConstraintsSaveError}
        />
        <p role="status" className="text-xs text-muted-foreground">
          Loading constraints…
        </p>
      </>
    )
  }
  if (isError) {
    return (
      <>
        <ConstraintsSaveErrors
          saveError={saveError}
          scheduleAfterConstraintsSaveError={scheduleAfterConstraintsSaveError}
        />
        <p role="alert" className="text-xs text-destructive">
          Constraints could not be loaded.
        </p>
      </>
    )
  }

  if (variant === 'desktop') {
    if (value === null) {
      return (
        <div className="flex flex-col items-start gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onAdd}
            className="self-start"
          >
            <Plus className="size-3.5" />
            Add constraints
          </Button>
          <ConstraintsSaveErrors
            saveError={saveError}
            scheduleAfterConstraintsSaveError={
              scheduleAfterConstraintsSaveError
            }
          />
        </div>
      )
    }

    return (
      <div className="flex flex-col gap-3">
        <ConstraintsSaveErrors
          saveError={saveError}
          scheduleAfterConstraintsSaveError={scheduleAfterConstraintsSaveError}
        />
        <ConstraintEditor
          variant="desktop"
          value={value}
          isPending={isPending}
          onChange={onChange}
          onRemove={onRemove}
        />
      </div>
    )
  }

  if (value === null) {
    return (
      <div className="flex flex-col items-start gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setIsExpanded(true)
            onAdd()
          }}
          className="self-start"
        >
          <Plus className="size-3.5" />
          Add constraints
        </Button>
        <ConstraintsSaveErrors
          saveError={saveError}
          scheduleAfterConstraintsSaveError={scheduleAfterConstraintsSaveError}
        />
      </div>
    )
  }

  return (
    <div className={cn('flex min-w-0 flex-col gap-2', isExpanded && 'w-full')}>
      <button
        type="button"
        aria-expanded={isExpanded}
        onClick={() => {
          setIsExpanded((expanded) => !expanded)
        }}
        className="inline-flex min-h-9 max-w-full items-center gap-2 self-start rounded-lg border border-border px-3 py-2 text-xs font-mono text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <SlidersHorizontal className="size-3.5 shrink-0" />
        <span className="break-words text-left">
          {scheduleConstraintSummary(value)}
        </span>
      </button>
      <ConstraintsSaveErrors
        saveError={saveError}
        scheduleAfterConstraintsSaveError={scheduleAfterConstraintsSaveError}
      />
      {isExpanded && (
        <div className="w-full rounded-lg border border-border p-3">
          <ConstraintEditor
            variant="mobile"
            value={value}
            isPending={isPending}
            onChange={onChange}
            onRemove={() => {
              setIsExpanded(false)
              onRemove()
            }}
          />
        </div>
      )}
    </div>
  )
}

function ConstraintsSaveErrors({
  saveError,
  scheduleAfterConstraintsSaveError,
}: {
  saveError: boolean
  scheduleAfterConstraintsSaveError: boolean
}) {
  if (!saveError && !scheduleAfterConstraintsSaveError) return null
  return (
    <>
      {saveError && (
        <p role="alert" className="text-xs text-destructive">
          Failed to save schedule constraints.
        </p>
      )}
      {scheduleAfterConstraintsSaveError && (
        <p role="alert" className="text-xs text-destructive">
          Schedule changes were not saved. Constraint changes were saved.
        </p>
      )}
    </>
  )
}

function ConstraintEditor({
  variant,
  value,
  isPending,
  onChange,
  onRemove,
}: {
  variant: 'desktop' | 'mobile'
  value: ScheduleConstraintFormState
  isPending: boolean
  onChange: (value: ScheduleConstraintFormState) => void
  onRemove: () => void
}) {
  const error = scheduleConstraintFormStateError(value)

  return (
    <div className="flex flex-col gap-3">
      <span className="flex items-center gap-1 font-mono text-2xs tracking-widest text-muted-foreground-faint">
        <SlidersHorizontal className="size-3.5" />
        Constraints
      </span>

      <div className="flex flex-wrap items-end gap-3">
        <InlineFieldGroup label="Per week" icon={null}>
          <Input
            type="number"
            variant="ghost"
            min="0"
            max="7"
            step="1"
            value={value.weeklyMin}
            disabled={isPending}
            onChange={(event) => {
              onChange({ ...value, weeklyMin: event.target.value })
            }}
            aria-label="Minimum per week"
            placeholder="—"
            className="w-11"
          />
          <span className="text-muted-foreground">–</span>
          <Input
            type="number"
            variant="ghost"
            min="0"
            max="7"
            step="1"
            value={value.weeklyMax}
            disabled={isPending}
            onChange={(event) => {
              onChange({ ...value, weeklyMax: event.target.value })
            }}
            aria-label="Maximum per week"
            placeholder="—"
            className="w-11"
          />
        </InlineFieldGroup>

        <InlineFieldGroup label="Target" icon={null}>
          <Input
            type="number"
            variant="ghost"
            min="0"
            max="7"
            step="1"
            value={value.weeklyTarget}
            disabled={isPending}
            onChange={(event) => {
              onChange({ ...value, weeklyTarget: event.target.value })
            }}
            aria-label="Target per week"
            placeholder="—"
            className="w-12"
          />
        </InlineFieldGroup>

        <InlineFieldGroup label="Max in a row" icon={null}>
          <Input
            type="number"
            variant="ghost"
            min="1"
            step="1"
            value={value.maxConsecutiveDays}
            disabled={isPending}
            onChange={(event) => {
              onChange({ ...value, maxConsecutiveDays: event.target.value })
            }}
            aria-label="Maximum consecutive days"
            placeholder="—"
            className="w-12"
          />
          <span className="text-xs text-muted-foreground">days</span>
        </InlineFieldGroup>
      </div>

      <InlineFieldGroup label="Window" icon={<Clock className="size-3.5" />}>
        <Input
          type="time"
          variant="ghost"
          value={value.windowStart}
          disabled={isPending}
          onChange={(event) => {
            onChange({ ...value, windowStart: event.target.value })
          }}
          aria-label="Window start"
          className="w-24"
        />
        <span className="text-muted-foreground">–</span>
        <Input
          type="time"
          variant="ghost"
          value={value.windowEnd}
          disabled={isPending}
          onChange={(event) => {
            onChange({ ...value, windowEnd: event.target.value })
          }}
          aria-label="Window end"
          className="w-24"
        />
      </InlineFieldGroup>

      <div className="flex flex-col gap-1">
        <span className="font-mono text-2xs tracking-widest text-muted-foreground-faint">
          Weekdays
        </span>
        <div
          className={cn(
            'gap-0 md:gap-1',
            variant === 'mobile'
              ? 'grid grid-cols-7'
              : 'grid grid-cols-7 md:flex',
          )}
        >
          {weekdays.map(({ dayOfWeek, label, name }) => {
            const preference = value.weekdays[dayOfWeek] ?? 'preferred'
            return (
              <button
                key={dayOfWeek}
                type="button"
                aria-label={`${name}: ${preferenceLabels[preference]}`}
                aria-pressed={preference !== 'preferred'}
                title={`${name}: ${preferenceLabels[preference]}`}
                disabled={isPending}
                onClick={() => {
                  onChange({
                    ...value,
                    weekdays: value.weekdays.map((current, index) =>
                      index === dayOfWeek
                        ? cycleScheduleConstraintWeekdayPreference(current)
                        : current,
                    ),
                  })
                }}
                className={cn(
                  'flex h-11 min-w-0 flex-col items-center justify-center gap-0.5 border text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
                  variant === 'mobile'
                    ? 'w-full'
                    : 'w-full md:w-15 md:flex-none',
                  preferenceClasses[preference],
                )}
              >
                <span
                  className={cn(preference === 'excluded' && 'line-through')}
                >
                  {label}
                </span>
                <span className="whitespace-nowrap font-mono font-normal max-md:tracking-wider schedule-constraint-preference-label">
                  {preferenceCellLabels[preference]}
                </span>
              </button>
            )
          })}
        </div>
        <span className="text-xs text-muted-foreground">
          Click a day to cycle OK → If free → Backup → Never.
        </span>
      </div>

      {error !== null && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      <Button
        variant="ghost"
        size="sm"
        disabled={isPending}
        onClick={onRemove}
        className="self-start text-destructive hover:text-destructive"
      >
        <Trash2 className="size-3.5" />
        Remove constraints
      </Button>
    </div>
  )
}
