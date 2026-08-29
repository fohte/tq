import { TaskRowAppearance } from '#components/task/task-row-appearance'
import { Panel } from '#components/ui/panel'
import { SectionHeading } from '#components/ui/section-heading'
import type { LinkedTaskSummary } from '#hooks/use-tasks'

function LinkedTaskGroup({
  label,
  tasks,
}: {
  label: string
  tasks: LinkedTaskSummary[]
}) {
  if (tasks.length === 0) return null

  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-2xs text-muted-foreground-faint">
        {label}
      </span>
      <Panel>
        {tasks.map((task) => (
          <TaskRowAppearance key={task.id} task={task} />
        ))}
      </Panel>
    </div>
  )
}

export function TaskLinkedTasksSection({
  outgoing,
  incoming,
}: {
  outgoing: LinkedTaskSummary[]
  incoming: LinkedTaskSummary[]
}) {
  const isEmpty = outgoing.length === 0 && incoming.length === 0

  return (
    <div className="flex flex-col gap-2.5">
      <SectionHeading level={3}>linked tasks</SectionHeading>

      {isEmpty ? (
        <p className="font-mono text-xs text-muted-foreground">
          No linked tasks. Mention a task with #123 in the description, a page,
          or a comment to link it.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <LinkedTaskGroup label="mentions" tasks={outgoing} />
          <LinkedTaskGroup label="mentioned by" tasks={incoming} />
        </div>
      )}
    </div>
  )
}
