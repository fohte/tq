import { Clock, Layers, Palette, Repeat, X } from 'lucide-react'
import { useCallback, useState } from 'react'

import { Button } from '#components/ui/button'
import {
  Dialog,
  DialogOverlay,
  DialogPopup,
  DialogPortal,
} from '#components/ui/dialog'
import { Input } from '#components/ui/input'
import {
  ExpandableFieldChip,
  InlineFieldGroup,
} from '#components/ui/modal-field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#components/ui/select'
import type { CreateScheduleInput } from '#hooks/use-schedules'
import { useCreateSchedule } from '#hooks/use-schedules'
import { selectValueHandler } from '#lib/form-utils'
import { cn } from '#lib/utils'

interface CreateScheduleModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type ContextValue = 'work' | 'personal'
const contextValues = ['', 'work', 'personal'] as const satisfies readonly (
  ContextValue | ''
)[]
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
        <DialogPopup onKeyDown={handleKeyDown}>
          {/* PC Modal */}
          <div className="fixed inset-0 z-50 hidden items-center justify-center p-8 md:flex">
            <div className="flex max-h-full w-full max-w-[500px] flex-col overflow-hidden rounded-2xl bg-card shadow-2xl ring-1 ring-foreground/10">
              {/* Header */}
              <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
                <span className="text-base font-semibold text-foreground">
                  New Schedule
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    handleOpenChange(false)
                  }}
                >
                  <X className="size-5" />
                  <span className="sr-only">Close</span>
                </Button>
              </div>

              {/* Body */}
              <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
                {/* Title */}
                <Input
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value)
                  }}
                  placeholder="Schedule title"
                  autoFocus
                  className="h-auto border-0 bg-transparent p-0 text-xl font-medium shadow-none focus-visible:ring-0 focus-visible:border-0"
                />

                {/* Time fields */}
                <div className="flex items-end gap-4">
                  <InlineFieldGroup
                    label="Start"
                    icon={<Clock className="size-3.5" />}
                  >
                    <Input
                      type="time"
                      value={startTime}
                      onChange={(e) => {
                        setStartTime(e.target.value)
                      }}
                      className="h-auto w-24 border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0 focus-visible:border-0"
                    />
                  </InlineFieldGroup>
                  <InlineFieldGroup
                    label="End"
                    icon={<Clock className="size-3.5" />}
                  >
                    <Input
                      type="time"
                      value={endTime}
                      onChange={(e) => {
                        setEndTime(e.target.value)
                      }}
                      className="h-auto w-24 border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0 focus-visible:border-0"
                    />
                  </InlineFieldGroup>
                </div>

                {startTime && endTime && startTime > endTime && (
                  <p className="text-xs text-muted-foreground">
                    Cross-midnight schedule: {startTime} → {endTime} (next day)
                  </p>
                )}

                {/* Recurrence */}
                <div className="flex flex-col gap-2">
                  <InlineFieldGroup
                    label="Repeat"
                    icon={<Repeat className="size-3.5" />}
                  >
                    <Select
                      value={recurrenceType}
                      onValueChange={selectValueHandler(
                        setRecurrenceType,
                        recurrenceValues,
                      )}
                    >
                      <SelectTrigger
                        size="sm"
                        className="h-auto border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0"
                      >
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </InlineFieldGroup>

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
                  )}

                  {recurrenceType === 'monthly' && (
                    <InlineFieldGroup label="Day of month" icon={null}>
                      <Input
                        type="number"
                        min="1"
                        max="31"
                        value={dayOfMonth}
                        onChange={(e) => {
                          setDayOfMonth(e.target.value)
                        }}
                        placeholder="1-31"
                        className="h-auto w-16 border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0 focus-visible:border-0"
                      />
                    </InlineFieldGroup>
                  )}
                </div>

                {/* Context & Color */}
                <div className="flex flex-wrap items-end gap-4">
                  <InlineFieldGroup
                    label="Context"
                    icon={<Layers className="size-3.5" />}
                  >
                    <Select
                      value={context}
                      onValueChange={selectValueHandler(
                        setContext,
                        contextValues,
                      )}
                    >
                      <SelectTrigger
                        size="sm"
                        className="h-auto border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0"
                      >
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">—</SelectItem>
                        <SelectItem value="work">Work</SelectItem>
                        <SelectItem value="personal">Personal</SelectItem>
                      </SelectContent>
                    </Select>
                  </InlineFieldGroup>

                  <div className="flex flex-col gap-1">
                    <span className="flex items-center gap-1 font-mono text-[9px] tracking-[0.08em] text-muted-foreground-faint">
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
                            'size-6 border-2 transition-all',
                            color === c
                              ? 'border-foreground scale-110'
                              : 'border-transparent hover:scale-110',
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
                <Button
                  variant="outline"
                  onClick={() => {
                    handleOpenChange(false)
                  }}
                >
                  Cancel
                </Button>
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
          <div className="fixed inset-0 z-50 flex items-end md:hidden">
            <div className="max-h-[85vh] w-full overflow-y-auto rounded-t-xl bg-card pb-5 shadow-2xl ring-1 ring-foreground/10">
              {/* Header */}
              <div className="sticky top-0 z-10 flex h-12 items-center justify-between border-b border-border bg-card px-4">
                <span className="text-base font-semibold text-foreground">
                  New Schedule
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    handleOpenChange(false)
                  }}
                >
                  <X className="size-5" />
                  <span className="sr-only">Close</span>
                </Button>
              </div>

              {/* Content */}
              <div className="flex flex-col gap-4 px-5 pt-4">
                {/* Title */}
                <Input
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value)
                  }}
                  placeholder="Schedule title"
                  autoFocus
                  className="h-auto border-0 bg-transparent p-0 text-lg font-medium shadow-none focus-visible:ring-0 focus-visible:border-0"
                />

                <div className="h-px bg-border" />

                {/* Chip row */}
                <div className="flex flex-wrap gap-2">
                  <ExpandableFieldChip
                    icon={<Clock className="size-3.5" />}
                    label={startTime || 'Start'}
                    active={!!startTime}
                    expanded={() => (
                      <Input
                        type="time"
                        value={startTime}
                        onChange={(e) => {
                          setStartTime(e.target.value)
                        }}
                        autoFocus
                        className="h-auto w-24 border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0 focus-visible:border-0"
                      />
                    )}
                  />
                  <ExpandableFieldChip
                    icon={<Clock className="size-3.5" />}
                    label={endTime || 'End'}
                    active={!!endTime}
                    expanded={() => (
                      <Input
                        type="time"
                        value={endTime}
                        onChange={(e) => {
                          setEndTime(e.target.value)
                        }}
                        autoFocus
                        className="h-auto w-24 border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0 focus-visible:border-0"
                      />
                    )}
                  />
                  <ExpandableFieldChip
                    icon={<Repeat className="size-3.5" />}
                    label={recurrenceType || 'Repeat'}
                    active={!!recurrenceType}
                    expanded={(close) => (
                      <Select
                        value={recurrenceType}
                        onValueChange={(value) => {
                          selectValueHandler(
                            setRecurrenceType,
                            recurrenceValues,
                          )(value)
                          close()
                        }}
                      >
                        <SelectTrigger
                          size="sm"
                          autoFocus
                          className="h-auto border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0"
                        >
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <ExpandableFieldChip
                    icon={<Layers className="size-3.5" />}
                    label={context ? contextLabels[context] : 'Context'}
                    active={!!context}
                    expanded={(close) => (
                      <Select
                        value={context}
                        onValueChange={(value) => {
                          selectValueHandler(setContext, contextValues)(value)
                          close()
                        }}
                      >
                        <SelectTrigger
                          size="sm"
                          autoFocus
                          className="h-auto border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0"
                        >
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          <SelectItem value="work">Work</SelectItem>
                          <SelectItem value="personal">Personal</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
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
                          'size-6 border-2 transition-all',
                          color === c
                            ? 'border-foreground scale-110'
                            : 'border-transparent hover:scale-110',
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
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}
