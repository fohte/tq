import type { IScaleConfig, ITask } from '@svar-ui/react-gantt'
import type { ProjectTask } from '@web/hooks/use-projects'

export type GanttScale = 'day' | 'week' | 'month'

export type GanttTaskType = 'todo' | 'in_progress' | 'completed' | 'summary'

export const GANTT_TASK_TYPES: Array<{
  id: GanttTaskType
  label: string
  summary?: boolean
}> = [
  { id: 'todo', label: 'Todo' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'completed', label: 'Completed' },
  { id: 'summary', label: 'Summary', summary: true },
]

const GANTT_ROOT_ID = 0

function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00`)
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

export function toDateOnlyString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${String(year)}-${month}-${day}`
}

export function buildGanttTasks(tasks: ProjectTask[]): ITask[] {
  const childCounts = new Map<string, number>()
  for (const task of tasks) {
    if (task.parentId != null) {
      childCounts.set(task.parentId, (childCounts.get(task.parentId) ?? 0) + 1)
    }
  }

  return tasks.map((task) => {
    const hasChildren = (childCounts.get(task.id) ?? 0) > 0
    const hasFullRange = task.startDate != null && task.dueDate != null

    return {
      id: task.id,
      text: task.title,
      parent: task.parentId ?? GANTT_ROOT_ID,
      type: hasChildren ? 'summary' : task.status,
      unscheduled: !hasFullRange,
      ...(hasFullRange && {
        start: parseDateOnly(task.startDate ?? ''),
        end: addDays(parseDateOnly(task.dueDate ?? ''), 1),
      }),
    }
  })
}

function getISOWeek(date: Date): number {
  const target = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  )
  const dayNum = target.getUTCDay() || 7
  target.setUTCDate(target.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1))
  return Math.ceil(
    ((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  )
}

function formatMonthDay(date: Date): string {
  return `${String(date.getMonth() + 1)}/${String(date.getDate())}`
}

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function formatMonthYearShort(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function formatWeekRange(start: Date, next?: Date): string {
  const lastDay = next ? addDays(next, -1) : start
  return `W${String(getISOWeek(start))} (${formatMonthDay(start)}-${formatMonthDay(lastDay)})`
}

export function getScaleConfig(scale: GanttScale): IScaleConfig[] {
  switch (scale) {
    case 'day':
      return [
        { unit: 'month', step: 1, format: formatMonthYear },
        { unit: 'day', step: 1, format: formatMonthDay },
      ]
    case 'week':
      return [
        { unit: 'month', step: 1, format: formatMonthYear },
        { unit: 'week', step: 1, format: formatWeekRange },
      ]
    case 'month':
      return [{ unit: 'month', step: 1, format: formatMonthYearShort }]
  }
}
