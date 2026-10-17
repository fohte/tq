import type {
  ScheduleConstraint,
  ScheduleConstraintInput,
} from '#hooks/use-schedules'

type ScheduleConstraintWeekdayPreference =
  ScheduleConstraint['weekdays'][number]['preference']

export interface ScheduleConstraintFormState {
  weeklyMin: string
  weeklyMax: string
  weeklyTarget: string
  maxConsecutiveDays: string
  windowStart: string
  windowEnd: string
  weekdays: ScheduleConstraintWeekdayPreference[]
}

const weekdayPreferenceOrder: ScheduleConstraintWeekdayPreference[] = [
  'preferred',
  'if_free',
  'reserve',
  'excluded',
]

export function emptyScheduleConstraintFormState(): ScheduleConstraintFormState {
  return {
    weeklyMin: '',
    weeklyMax: '',
    weeklyTarget: '',
    maxConsecutiveDays: '',
    windowStart: '',
    windowEnd: '',
    weekdays: Array.from({ length: 7 }, () => 'preferred'),
  }
}

export function scheduleConstraintFormStateFromSaved(
  constraint: ScheduleConstraint | null,
): ScheduleConstraintFormState | null {
  if (constraint === null) return null

  const form = emptyScheduleConstraintFormState()
  for (const weekday of constraint.weekdays) {
    form.weekdays[weekday.dayOfWeek] = weekday.preference
  }

  return {
    ...form,
    weeklyMin: constraint.weeklyMin?.toString() ?? '',
    weeklyMax: constraint.weeklyMax?.toString() ?? '',
    weeklyTarget: constraint.weeklyTarget?.toString() ?? '',
    maxConsecutiveDays: constraint.maxConsecutiveDays?.toString() ?? '',
    windowStart: constraint.windowStart ?? '',
    windowEnd: constraint.windowEnd ?? '',
  }
}

export function cycleScheduleConstraintWeekdayPreference(
  preference: ScheduleConstraintWeekdayPreference,
): ScheduleConstraintWeekdayPreference {
  const index = weekdayPreferenceOrder.indexOf(preference)
  return (
    weekdayPreferenceOrder[(index + 1) % weekdayPreferenceOrder.length] ??
    'preferred'
  )
}

export function scheduleConstraintFormStateError(
  form: ScheduleConstraintFormState,
): string | null {
  const weeklyValues = [form.weeklyMin, form.weeklyMax, form.weeklyTarget]
  if (
    weeklyValues.some(
      (value) =>
        value !== '' &&
        (!Number.isInteger(Number(value)) ||
          Number(value) < 0 ||
          Number(value) > 7),
    )
  ) {
    return 'Use whole numbers from 0 to 7 for weekly counts.'
  }
  if (
    form.maxConsecutiveDays !== '' &&
    (!Number.isInteger(Number(form.maxConsecutiveDays)) ||
      Number(form.maxConsecutiveDays) < 1)
  ) {
    return 'Use a whole number of at least 1 for consecutive days.'
  }

  const weeklyMin = nullableNumber(form.weeklyMin)
  const weeklyMax = nullableNumber(form.weeklyMax)
  const weeklyTarget = nullableNumber(form.weeklyTarget)
  if (weeklyMin !== null && weeklyMax !== null && weeklyMin > weeklyMax) {
    return 'Minimum per week cannot exceed the maximum.'
  }
  if (
    weeklyTarget !== null &&
    (weeklyTarget < (weeklyMin ?? 0) || weeklyTarget > (weeklyMax ?? 7))
  ) {
    return 'Target must be within the weekly range.'
  }
  if ((form.windowStart === '') !== (form.windowEnd === '')) {
    return 'Set both window times.'
  }
  if (
    [form.windowStart, form.windowEnd].some(
      (time) => time !== '' && !isScheduleTime(time),
    )
  ) {
    return 'Use a valid time for the window.'
  }

  return null
}

export function scheduleConstraintInputFromFormState(
  form: ScheduleConstraintFormState | null,
): ScheduleConstraintInput | null {
  if (form === null || scheduleConstraintFormStateError(form) !== null) {
    return null
  }

  return {
    weeklyMin: nullableNumber(form.weeklyMin),
    weeklyMax: nullableNumber(form.weeklyMax),
    weeklyTarget: nullableNumber(form.weeklyTarget),
    maxConsecutiveDays: nullableNumber(form.maxConsecutiveDays),
    windowStart: form.windowStart || null,
    windowEnd: form.windowEnd || null,
    weekdays: form.weekdays.flatMap((preference, dayOfWeek) =>
      preference === 'preferred' ? [] : [{ dayOfWeek, preference }],
    ),
  }
}

export function scheduleConstraintsMatchSaved(
  form: ScheduleConstraintFormState | null,
  saved: ScheduleConstraint | null,
): boolean {
  if (form === null) return saved === null
  if (scheduleConstraintFormStateError(form) !== null) return false

  const next = scheduleConstraintInputFromFormState(form)
  const current = saved === null ? null : savedConstraintInput(saved)
  return JSON.stringify(next) === JSON.stringify(current)
}

export function scheduleConstraintSummary(
  form: ScheduleConstraintFormState,
): string {
  const parts: string[] = []
  const { weeklyMin, weeklyMax, weeklyTarget, maxConsecutiveDays } = form

  if (weeklyMin && weeklyMax) {
    parts.push(`${weeklyMin}–${weeklyMax}/wk`)
  } else if (weeklyTarget) {
    parts.push(`target ${weeklyTarget}/wk`)
  } else if (weeklyMin) {
    parts.push(`min ${weeklyMin}/wk`)
  } else if (weeklyMax) {
    parts.push(`max ${weeklyMax}/wk`)
  }
  if (maxConsecutiveDays) parts.push(`max ${maxConsecutiveDays} in a row`)
  if (parts.length === 0 && form.windowStart && form.windowEnd) {
    parts.push(`${form.windowStart}–${form.windowEnd}`)
  }
  const customWeekdays = form.weekdays.filter(
    (preference) => preference !== 'preferred',
  ).length
  if (parts.length === 0 && customWeekdays > 0) {
    parts.push(
      `${String(customWeekdays)} weekday ${customWeekdays === 1 ? 'rule' : 'rules'}`,
    )
  }

  return parts.join(' · ') || 'Constraints'
}

function savedConstraintInput(
  constraint: ScheduleConstraint,
): ScheduleConstraintInput {
  return {
    weeklyMin: constraint.weeklyMin,
    weeklyMax: constraint.weeklyMax,
    weeklyTarget: constraint.weeklyTarget,
    maxConsecutiveDays: constraint.maxConsecutiveDays,
    windowStart: constraint.windowStart,
    windowEnd: constraint.windowEnd,
    weekdays: constraint.weekdays
      .filter(({ preference }) => preference !== 'preferred')
      .sort((left, right) => left.dayOfWeek - right.dayOfWeek),
  }
}

function nullableNumber(value: string): number | null {
  return value === '' ? null : Number(value)
}

function isScheduleTime(value: string): boolean {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return false
  const hours = Number(match[1])
  const minutes = Number(match[2])
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59
}
