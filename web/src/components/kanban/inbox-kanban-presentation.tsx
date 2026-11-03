import { TaskKanban } from '#components/kanban/task-kanban'
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
  onDrop,
}: {
  priorityColumns: InboxPriorityColumn[]
  waitingTasks: Task[]
  waitingIsLoading: boolean
  waitingHasError: boolean
  onDrop: (taskId: string, priority: TaskPriority) => void
}) {
  const sortedPriorityColumns = [...priorityColumns].sort(
    (left, right) => left.setting.sortOrder - right.setting.sortOrder,
  )
  const columns = sortedPriorityColumns.map(
    ({ setting, tasks, isLoading }) => ({
      id: priorityColumnId(setting.priority),
      title: setting.name,
      tasks,
      isLoading,
    }),
  )

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
