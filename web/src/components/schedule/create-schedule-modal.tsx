import { Button } from '@web/components/ui/button'
import { Dialog, DialogOverlay, DialogPortal } from '@web/components/ui/dialog'
import type { CreateScheduleInput } from '@web/hooks/use-schedules'
import { useCreateSchedule } from '@web/hooks/use-schedules'
import { selectHandler } from '@web/lib/form-utils'
import { cn } from '@web/lib/utils'
import { Clock, Layers, Palette, Repeat, X } from 'lucide-react'
import { useCallback, useState } from 'react'

interface CreateScheduleModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type ContextValue = 'work' | 'personal' | 'dev'
const contextValues = [
  '',
  'work',
  'personal',
  'dev',
] as const satisfies readonly (ContextValue | '')[]
type RecurrenceType = 'daily' | 'weekly' | 'monthly' | 'custom'
const recurrenceValues = [
  '',
  'daily',
  'weekly',
  'monthly',
  'custom',
] as const satisfies readonly (RecurrenceType | '')[]

const contextLabels: Record<ContextValue, string> = {
  work: 'Work',
  personal: 'Personal',
  dev: 'Dev',
}

const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const presetColors = [
  '#6C63FF',
  '#FF6B6B',
  '#4ECDC4',
  '#FFE66D',
  '#95E1D3',
  '#F38181',
  '#AA96DA',
  '#A8D8EA',
]

export function CreateScheduleModal({
  open,
  onOpenChange,
}: CreateScheduleModalProps) {
  const [title, setTitle] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType | ''>('')
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([])
  const [dayOfMonth, setDayOfMonth] = useState('')
  const [context, setContext] = useState<ContextValue | ''>('')
  const [color, setColor] = useState('')
  const createSchedule = useCreateSchedule()

  const resetForm = useCallback(() => {
    setTitle('')
    setStartTime('')
    setEndTime('')
    setRecurrenceType('')
    setDaysOfWeek([])
    setDayOfMonth('')
    setContext('')
    setColor('')
  }, [])

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
    if (!title.trim() || !startTime || !endTime || createSchedule.isPending)
      return

    const input: CreateScheduleInput = {
      title: title.trim(),
      startTime,
      endTime,
      ...(recurrenceType
        ? {
            recurrence: {
              type: recurrenceType,
              interval: 1,
              ...(recurrenceType === 'weekly' && daysOfWeek.length > 0
                ? { daysOfWeek }
                : {}),
              ...(recurrenceType === 'monthly' && dayOfMonth
                ? { dayOfMonth: Number.parseInt(dayOfMonth, 10) }
                : {}),
            },
          }
        : {}),
      ...(context ? { context } : {}),
      ...(color ? { color } : {}),
    }

    createSchedule.mutate(input, {
      onSuccess: () => {
        resetForm()
        onOpenChange(false)
      },
    })
  }

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

  const canSubmit = title.trim() && startTime && endTime

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-black/40" />
        {/* PC Modal */}
        <div
          className="fixed inset-0 z-50 hidden items-center justify-center p-8 md:flex"
          onKeyDown={handleKeyDown}
        >
          <div className="flex max-h-full w-full max-w-[500px] flex-col overflow-hidden rounded-2xl bg-card shadow-2xl ring-1 ring-foreground/10">
            {/* Header */}
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
              <span className="text-base font-semibold text-foreground">
                New Schedule
              </span>
              <button
                type="button"
                onClick={() => {
                  handleOpenChange(false)
                }}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
              {/* Title */}
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                }}
                placeholder="Schedule title"
                autoFocus
                className="w-full bg-transparent text-xl font-medium text-foreground outline-none placeholder:text-muted-foreground"
              />

              {/* Time fields */}
              <div className="flex items-end gap-4">
                <FieldGroup label="Start" icon={<Clock className="size-3.5" />}>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => {
                      setStartTime(e.target.value)
                    }}
                    className="w-24 bg-transparent text-xs text-foreground outline-none"
                  />
                </FieldGroup>
                <FieldGroup label="End" icon={<Clock className="size-3.5" />}>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => {
                      setEndTime(e.target.value)
                    }}
                    className="w-24 bg-transparent text-xs text-foreground outline-none"
                  />
                </FieldGroup>
              </div>

              {startTime && endTime && startTime > endTime && (
                <p className="text-xs text-muted-foreground">
                  Cross-midnight schedule: {startTime} → {endTime} (next day)
                </p>
              )}

              {/* Recurrence */}
              <div className="flex flex-col gap-2">
                <FieldGroup
                  label="Repeat"
                  icon={<Repeat className="size-3.5" />}
                >
                  <select
                    value={recurrenceType}
                    onChange={selectHandler(
                      setRecurrenceType,
                      recurrenceValues,
                    )}
                    className="bg-transparent text-xs text-foreground outline-none"
                  >
                    <option value="">None</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </FieldGroup>

                {recurrenceType === 'weekly' && (
                  <div className="flex gap-1">
                    {dayLabels.map((label, idx) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => {
                          toggleDay(idx)
                        }}
                        className={cn(
                          'flex size-8 items-center justify-center rounded-full text-xs font-medium transition-colors',
                          daysOfWeek.includes(idx)
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary text-muted-foreground hover:bg-secondary/80',
                        )}
                      >
                        {label.charAt(0)}
                      </button>
                    ))}
                  </div>
                )}

                {recurrenceType === 'monthly' && (
                  <FieldGroup label="Day of month" icon={null}>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={dayOfMonth}
                      onChange={(e) => {
                        setDayOfMonth(e.target.value)
                      }}
                      placeholder="1-31"
                      className="w-16 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
                    />
                  </FieldGroup>
                )}
              </div>

              {/* Context & Color */}
              <div className="flex flex-wrap items-end gap-4">
                <FieldGroup
                  label="Context"
                  icon={<Layers className="size-3.5" />}
                >
                  <select
                    value={context}
                    onChange={selectHandler(setContext, contextValues)}
                    className="bg-transparent text-xs text-foreground outline-none"
                  >
                    <option value="">—</option>
                    <option value="work">Work</option>
                    <option value="personal">Personal</option>
                    <option value="dev">Dev</option>
                  </select>
                </FieldGroup>

                <div className="flex flex-col gap-1">
                  <span className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                    <Palette className="size-3.5" />
                    Color
                  </span>
                  <div className="flex gap-1">
                    {presetColors.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          setColor(color === c ? '' : c)
                        }}
                        className={cn(
                          'size-6 rounded-full border-2 transition-all',
                          color === c
                            ? 'border-foreground scale-110'
                            : 'border-transparent hover:scale-105',
                        )}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-border px-6 py-3">
              <button
                type="button"
                onClick={() => {
                  handleOpenChange(false)
                }}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Cancel
              </button>
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit || createSchedule.isPending}
                className="h-9 rounded-lg px-4"
              >
                Create Schedule
              </Button>
            </div>
          </div>
        </div>

        {/* SP Modal (bottom sheet) */}
        <div
          className="fixed inset-0 z-50 flex items-end md:hidden"
          onKeyDown={handleKeyDown}
        >
          <div className="max-h-[85vh] w-full overflow-y-auto rounded-t-xl bg-card pb-5 shadow-2xl ring-1 ring-foreground/10">
            {/* Header */}
            <div className="sticky top-0 z-10 flex h-12 items-center justify-between border-b border-border bg-card px-4">
              <span className="text-base font-semibold text-foreground">
                New Schedule
              </span>
              <button
                type="button"
                onClick={() => {
                  handleOpenChange(false)
                }}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex flex-col gap-4 px-5 pt-4">
              {/* Title */}
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                }}
                placeholder="Schedule title"
                autoFocus
                className="w-full bg-transparent text-lg font-medium text-foreground outline-none placeholder:text-muted-foreground"
              />

              <div className="h-px bg-border" />

              {/* Chip row */}
              <div className="flex flex-wrap gap-2">
                <SpChip
                  icon={<Clock className="size-3.5" />}
                  label={startTime || 'Start'}
                  active={!!startTime}
                  expanded={
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => {
                        setStartTime(e.target.value)
                      }}
                      autoFocus
                      className="w-24 bg-transparent text-xs outline-none"
                    />
                  }
                />
                <SpChip
                  icon={<Clock className="size-3.5" />}
                  label={endTime || 'End'}
                  active={!!endTime}
                  expanded={
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => {
                        setEndTime(e.target.value)
                      }}
                      autoFocus
                      className="w-24 bg-transparent text-xs outline-none"
                    />
                  }
                />
                <SpChip
                  icon={<Repeat className="size-3.5" />}
                  label={recurrenceType || 'Repeat'}
                  active={!!recurrenceType}
                  expanded={
                    <select
                      value={recurrenceType}
                      onChange={selectHandler(
                        setRecurrenceType,
                        recurrenceValues,
                      )}
                      autoFocus
                      className="bg-transparent text-xs outline-none"
                    >
                      <option value="">None</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  }
                />
                <SpChip
                  icon={<Layers className="size-3.5" />}
                  label={context ? contextLabels[context] : 'Context'}
                  active={!!context}
                  expanded={
                    <select
                      value={context}
                      onChange={selectHandler(setContext, contextValues)}
                      autoFocus
                      className="bg-transparent text-xs outline-none"
                    >
                      <option value="">None</option>
                      <option value="work">Work</option>
                      <option value="personal">Personal</option>
                      <option value="dev">Dev</option>
                    </select>
                  }
                />
              </div>

              {recurrenceType === 'weekly' && (
                <div className="flex gap-1">
                  {dayLabels.map((label, idx) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        toggleDay(idx)
                      }}
                      className={cn(
                        'flex size-8 items-center justify-center rounded-full text-xs font-medium transition-colors',
                        daysOfWeek.includes(idx)
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-muted-foreground hover:bg-secondary/80',
                      )}
                    >
                      {label.charAt(0)}
                    </button>
                  ))}
                </div>
              )}

              {startTime && endTime && startTime > endTime && (
                <p className="text-xs text-muted-foreground">
                  Cross-midnight: {startTime} → {endTime} (next day)
                </p>
              )}

              {/* Color picker */}
              <div className="flex items-center gap-2">
                <Palette className="size-3.5 text-muted-foreground" />
                <div className="flex gap-1.5">
                  {presetColors.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        setColor(color === c ? '' : c)
                      }}
                      className={cn(
                        'size-6 rounded-full border-2 transition-all',
                        color === c
                          ? 'border-foreground scale-110'
                          : 'border-transparent',
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {/* Create button */}
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit || createSchedule.isPending}
                className="h-12 w-full rounded-lg text-base font-semibold"
              >
                Create
              </Button>
            </div>
          </div>
        </div>
      </DialogPortal>
    </Dialog>
  )
}

function FieldGroup({
  label,
  icon,
  children,
}: {
  label: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
        {icon}
        {label}
      </span>
      <div className="flex h-7 items-center rounded-md border border-border px-2 text-xs focus-within:border-primary/50">
        {children}
      </div>
    </div>
  )
}

function SpChip({
  icon,
  label,
  active,
  expanded,
}: {
  icon: React.ReactNode
  label: string
  active?: boolean
  expanded?: React.ReactNode
}) {
  const [isEditing, setIsEditing] = useState(false)

  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors',
        active === true
          ? 'bg-primary/10 text-primary'
          : 'bg-secondary text-muted-foreground',
      )}
    >
      {icon}
      {isEditing && expanded != null ? (
        <div
          onBlur={() => {
            setIsEditing(false)
          }}
        >
          {expanded}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setIsEditing(true)
          }}
          className="outline-none"
        >
          {label}
        </button>
      )}
    </div>
  )
}
