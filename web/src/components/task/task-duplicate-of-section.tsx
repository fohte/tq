import { TaskRowAppearance } from '#components/task/task-row-appearance'
import { Panel } from '#components/ui/panel'
import { SectionHeading } from '#components/ui/section-heading'
import type { LinkedTaskSummary } from '#hooks/use-tasks'

// Separate from TaskLinkedTasksSection: `duplicateOfTask` is a human-entered
// relation (set when closing a task as a duplicate), while linked tasks are
// derived from #123 mentions — keeping them visually apart avoids implying
// they're the same kind of data.
export function TaskDuplicateOfSection({
  duplicateOfTask,
}: {
  duplicateOfTask: LinkedTaskSummary | null
}) {
  if (duplicateOfTask == null) return null

  return (
    <div className="flex flex-col gap-2.5">
      <SectionHeading level={3}>duplicate of</SectionHeading>
      <Panel>
        <TaskRowAppearance task={duplicateOfTask} />
      </Panel>
    </div>
  )
}
