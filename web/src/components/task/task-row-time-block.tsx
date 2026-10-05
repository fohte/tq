import type { ReactNode } from 'react'

export interface TaskRowTimeBlockState {
  timeRanges: string[]
  isCurrentTimeBlock: boolean
  blockEndedAt?: string
}

export function getTaskRowTimeBlockExtras(
  state: TaskRowTimeBlockState | undefined,
): ReactNode[] {
  if (state == null) return []

  return [
    ...(state.timeRanges.length === 0
      ? []
      : [
          <span key="time-ranges" className="font-mono text-xs">
            {state.timeRanges.join(', ')}
          </span>,
        ]),
    ...(state.blockEndedAt == null
      ? []
      : [
          <span key="block-ended" className="text-xs text-destructive">
            block ended {state.blockEndedAt}
          </span>,
        ]),
  ]
}
