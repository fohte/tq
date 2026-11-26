import {
  TaskKanban,
  type TaskKanbanColumn,
} from '#components/kanban/task-kanban'
import type {
  PrioritySetting,
  TaskPriority,
} from '#hooks/use-priority-settings'
import type { Task } from '#hooks/use-tasks'

export interface InboxPriorityColumn {
  setting: PrioritySetting
  tasks: Task[]
  isLoading: boolean
}

export function InboxKanbanPresentation({
  priorityColumns,
  waitingTasks,
  waitingIsLoading,
  waitingHasError,
  prioritySettingsIsLoading,
  prioritySettingsHasError,
  onDrop,
}: {
  priorityColumns: InboxPriorityColumn[]
  waitingTasks: Task[]
  waitingIsLoading: boolean
  waitingHasError: boolean
  prioritySettingsIsLoading: boolean
  prioritySettingsHasError: boolean
  onDrop: (taskId: string, priority: TaskPriority) => void
}) {
  const sortedPriorityColumns = [...priorityColumns].sort(
    (left, right) => left.setting.sortOrder - right.setting.sortOrder,
  )
  const columns: TaskKanbanColumn[] = sortedPriorityColumns.map(
    ({ setting, tasks, isLoading }) => ({
      id: priorityColumnId(setting.priority),
      title: setting.name,
      tasks,
      isLoading,
    }),
  )
  if (columns.length === 0 && prioritySettingsIsLoading) {
    columns.push({
      id: 'priority-settings',
      title: 'Priorities',
      tasks: [],
      isLoading: true,
      loadingMessage: 'Loading priority settings...',
      allowsManualMoves: false,
    })
  } else if (columns.length === 0 && prioritySettingsHasError) {
    columns.push({
      id: 'priority-settings',
      title: 'Priorities',
      tasks: [],
      hasError: true,
      errorMessage: 'Failed to load priority settings.',
      allowsManualMoves: false,
    })
  }

  return (
    <TaskKanban
      columns={[
        ...columns,
        {
          id: 'waiting',
          title: 'Waiting',
          tasks: waitingTasks,
          isLoading: waitingIsLoading,
          hasError: waitingHasError,
          allowsManualMoves: false,
        },
      ]}
      onDrop={(taskId, columnId) => {
        const setting = sortedPriorityColumns.find(
          ({ setting: candidate }) =>
            priorityColumnId(candidate.priority) === columnId,
        )?.setting
        if (setting != null) onDrop(taskId, setting.priority)
      }}
    />
  )
}

function priorityColumnId(priority: TaskPriority) {
  return priority === null ? 'priority-unset' : `priority-${String(priority)}`
}
