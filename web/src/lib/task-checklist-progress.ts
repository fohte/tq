export interface ChecklistCompletionCount {
  completed: number
  total: number
}

const EMPTY_CHECKLIST_COMPLETION_COUNT: ChecklistCompletionCount = {
  completed: 0,
  total: 0,
}

export function getChecklistCompletionCount(
  value: ChecklistCompletionCount | undefined,
): ChecklistCompletionCount {
  return value ?? EMPTY_CHECKLIST_COMPLETION_COUNT
}
