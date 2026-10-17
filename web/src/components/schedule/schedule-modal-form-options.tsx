import { Button } from '@fohte/ui/button'

import { cn } from '#lib/utils'

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
  { name: 'Indigo', hex: '#6C63FF' },
  { name: 'Coral', hex: '#FF6B6B' },
  { name: 'Turquoise', hex: '#4ECDC4' },
  { name: 'Lemon', hex: '#FFE66D' },
  { name: 'Mint', hex: '#95E1D3' },
  { name: 'Salmon', hex: '#F38181' },
  { name: 'Lavender', hex: '#AA96DA' },
  { name: 'Sky blue', hex: '#A8D8EA' },
]

export function toggleWeekday(days: number[], day: number): number[] {
  return days.includes(day) ? days.filter((d) => d !== day) : [...days, day]
}

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
        <Button
          key={label}
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => {
            toggleDay(idx)
          }}
          className={cn(
            'gap-0 rounded-none border bg-transparent p-0 font-inherit font-medium shadow-none transition-colors hover:bg-transparent active:translate-y-0 text-xs',
            daysOfWeek.includes(idx)
              ? 'border-border-strong bg-surface-strong text-foreground'
              : 'border-border text-muted-foreground hover:border-border-strong',
          )}
        >
          {label.charAt(0)}
        </Button>
      ))}
    </div>
  )
}
