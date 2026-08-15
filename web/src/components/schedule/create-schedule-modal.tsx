import { useCallback, useState } from 'react'

import { ScheduleModalDesktopPanel } from '#components/schedule/create-schedule-modal-desktop-panel'
import { ScheduleModalMobilePanel } from '#components/schedule/create-schedule-modal-mobile-panel'
import {
  Dialog,
  DialogOverlay,
  DialogPopup,
  DialogPortal,
} from '#components/ui/dialog'
import type {
  CreateScheduleInput,
  Schedule,
  UpdateScheduleInput,
} from '#hooks/use-schedules'
import {
  useCreateSchedule,
  useDeleteSchedule,
  useUpdateSchedule,
} from '#hooks/use-schedules'
import { cn } from '#lib/utils'

interface CreateScheduleModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Presence switches the modal into edit mode. */
  schedule?: Schedule | undefined
}

export type ContextValue = 'work' | 'personal'
export const contextValues = [
  '',
  'work',
  'personal',
] as const satisfies readonly (ContextValue | '')[]
export type RecurrenceType = 'daily' | 'weekly' | 'monthly' | 'custom'
export const recurrenceValues = [
  '',
  'daily',
  'weekly',
  'monthly',
  'custom',
] as const satisfies readonly (RecurrenceType | '')[]

export const contextLabels: Record<ContextValue, string> = {
  work: 'Work',
  personal: 'Personal',
}

export const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export const presetColors = [
  '#6C63FF',
  '#FF6B6B',
  '#4ECDC4',
  '#FFE66D',
  '#95E1D3',
  '#F38181',
  '#AA96DA',
  '#A8D8EA',
]

/** Weekday toggle buttons shown when a weekly recurrence is selected. */
export function WeekdayToggleRow({
  daysOfWeek,
  toggleDay,
}: {
  daysOfWeek: number[]
  toggleDay: (day: number) => void
}) {
  return (
    <div className="flex gap-1">
      {dayLabels.map((label, idx) => (
        <button
          key={label}
          type="button"
          onClick={() => {
            toggleDay(idx)
          }}
          className={cn(
            'flex size-8 items-center justify-center border text-xs font-medium transition-colors',
            daysOfWeek.includes(idx)
              ? 'border-border-strong bg-surface-strong text-foreground'
              : 'border-border text-muted-foreground hover:border-border-strong',
          )}
        >
          {label.charAt(0)}
        </button>
      ))}
    </div>
  )
}

/** Props shared by the PC and mobile schedule modal panels. */
export interface SchedulePanelProps {
  schedule: Schedule | undefined
  handleOpenChange: (open: boolean) => void
  title: string
  setTitle: (value: string) => void
  startTime: string
  setStartTime: (value: string) => void
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
  onDelete: () => void
  isPending: boolean
  canSubmit: boolean
  handleSubmit: () => void
}

/**
 * Cross-midnight schedules are expanded into two per-date blocks by the
 * backend, so slicing either block's start/end yields a 00:00-rounded value
 * for the far side of midnight instead of the original startTime/endTime.
 */
function scheduleTimeOfDay(isoDateTime: string) {
  return isoDateTime.slice(11, 16)
}

function scheduleContext(schedule: Schedule | undefined): ContextValue | '' {
  if (schedule?.context === 'work' || schedule?.context === 'personal') {
    return schedule.context
  }
  return ''
}

export function CreateScheduleModal({
  open,
  onOpenChange,
  schedule,
}: CreateScheduleModalProps) {
  const [title, setTitle] = useState(schedule?.title ?? '')
  const [startTime, setStartTime] = useState(
    schedule ? scheduleTimeOfDay(schedule.start) : '',
  )
  const [endTime, setEndTime] = useState(
    schedule ? scheduleTimeOfDay(schedule.end) : '',
  )
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType | ''>(
    schedule?.recurrence?.type ?? '',
  )
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(
    schedule?.recurrence?.daysOfWeek ?? [],
  )
  const [dayOfMonth, setDayOfMonth] = useState(
    schedule?.recurrence?.dayOfMonth != null
      ? String(schedule.recurrence.dayOfMonth)
      : '',
  )
  const [context, setContext] = useState<ContextValue | ''>(
    scheduleContext(schedule),
  )
  const [color, setColor] = useState(schedule?.color ?? '')
  const createSchedule = useCreateSchedule()
  const updateSchedule = useUpdateSchedule()
  const deleteSchedule = useDeleteSchedule()
  const isPending =
    createSchedule.isPending ||
    updateSchedule.isPending ||
    deleteSchedule.isPending

  const resetForm = useCallback(() => {
    setTitle(schedule?.title ?? '')
    setStartTime(schedule ? scheduleTimeOfDay(schedule.start) : '')
    setEndTime(schedule ? scheduleTimeOfDay(schedule.end) : '')
    setRecurrenceType(schedule?.recurrence?.type ?? '')
    setDaysOfWeek(schedule?.recurrence?.daysOfWeek ?? [])
    setDayOfMonth(
      schedule?.recurrence?.dayOfMonth != null
        ? String(schedule.recurrence.dayOfMonth)
        : '',
    )
    setContext(scheduleContext(schedule))
    setColor(schedule?.color ?? '')
  }, [schedule])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        resetForm()
      }
      onOpenChange(nextOpen)
    },
    [onOpenChange, resetForm],
  )

  const handleSubmit = () => {
    if (!title.trim() || !startTime || !endTime || isPending) return

    const recurrence = recurrenceType
      ? {
          type: recurrenceType,
          interval: schedule?.recurrence?.interval ?? 1,
          ...(recurrenceType === 'weekly' && daysOfWeek.length > 0
            ? { daysOfWeek }
            : {}),
          ...(recurrenceType === 'monthly' && dayOfMonth
            ? { dayOfMonth: Number.parseInt(dayOfMonth, 10) }
            : {}),
        }
      : null

    if (schedule) {
      const input: UpdateScheduleInput = {
        title: title.trim(),
        startTime,
        endTime,
        recurrence,
        context: context || null,
        color: color || null,
      }
      updateSchedule.mutate(
        { id: schedule.scheduleId, input },
        {
          onSuccess: () => {
            handleOpenChange(false)
          },
        },
      )
      return
    }

    const input: CreateScheduleInput = {
      title: title.trim(),
      startTime,
      endTime,
      ...(recurrence ? { recurrence } : {}),
      ...(context ? { context } : {}),
      ...(color ? { color } : {}),
    }

    createSchedule.mutate(input, {
      onSuccess: () => {
        handleOpenChange(false)
      },
    })
  }

  const handleDelete = useCallback(() => {
    if (!schedule) return
    deleteSchedule.mutate(schedule.scheduleId, {
      onSuccess: () => {
        handleOpenChange(false)
      },
    })
  }, [schedule, deleteSchedule, handleOpenChange])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const toggleDay = (day: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    )
  }

  const canSubmit = Boolean(title.trim() && startTime && endTime)

  const panelProps: SchedulePanelProps = {
    schedule,
    handleOpenChange,
    title,
    setTitle,
    startTime,
    setStartTime,
    endTime,
    setEndTime,
    recurrenceType,
    setRecurrenceType,
    daysOfWeek,
    toggleDay,
    dayOfMonth,
    setDayOfMonth,
    context,
    setContext,
    color,
    setColor,
    onDelete: handleDelete,
    isPending,
    canSubmit,
    handleSubmit,
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-black/40" />
        <DialogPopup onKeyDown={handleKeyDown}>
          <ScheduleModalDesktopPanel {...panelProps} />
          <ScheduleModalMobilePanel {...panelProps} />
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}
