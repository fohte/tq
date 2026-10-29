import { useCallback, useMemo, useState } from 'react'

import type { TemplateRecurrenceType } from '#components/recurring/recurrence-rule-fields'
import { toggleWeekday } from '#components/schedule/create-schedule-modal'
import { buildRecurrenceRule, parseRecurrenceInterval } from '#lib/recurrence'

interface InitialRecurrenceRuleDraft {
  type: TemplateRecurrenceType
  intervalInput: string
  daysOfWeek?: number[]
  dayOfMonth?: string
}

const emptyDaysOfWeek: number[] = []

export function useRecurrenceRuleDraft(initial: InitialRecurrenceRuleDraft) {
  const initialDaysOfWeek = initial.daysOfWeek ?? emptyDaysOfWeek
  const initialDayOfMonth = initial.dayOfMonth ?? ''
  const [type, setType] = useState(initial.type)
  const [intervalInput, setIntervalInput] = useState(initial.intervalInput)
  const [daysOfWeek, setDaysOfWeek] = useState(initialDaysOfWeek)
  const [dayOfMonth, setDayOfMonth] = useState(initialDayOfMonth)

  const intervalValue = parseRecurrenceInterval(intervalInput)
  const recurrenceRule = useMemo(
    () => buildRecurrenceRule(type, intervalValue, daysOfWeek, dayOfMonth),
    [dayOfMonth, daysOfWeek, intervalValue, type],
  )

  const reset = useCallback(() => {
    setType(initial.type)
    setIntervalInput(initial.intervalInput)
    setDaysOfWeek(initialDaysOfWeek)
    setDayOfMonth(initialDayOfMonth)
  }, [
    initial.type,
    initial.intervalInput,
    initialDaysOfWeek,
    initialDayOfMonth,
  ])

  const toggleDay = useCallback((day: number) => {
    setDaysOfWeek((previous) => toggleWeekday(previous, day))
  }, [])

  return {
    type,
    setType,
    intervalInput,
    setIntervalInput,
    intervalValue,
    daysOfWeek,
    setDaysOfWeek,
    toggleDay,
    dayOfMonth,
    setDayOfMonth,
    recurrenceRule,
    reset,
  }
}
