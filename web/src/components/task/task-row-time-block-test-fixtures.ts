import type { TaskRowTimeBlockState } from '#components/task/task-row-time-block'

export function makeTaskRowTimeBlockState(
  overrides: Partial<TaskRowTimeBlockState> = {},
): TaskRowTimeBlockState {
  return {
    timeRanges: [],
    isCurrentTimeBlock: false,
    ...overrides,
  }
}
