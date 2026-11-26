import { useMemo } from 'react'

import type { PlanValue } from '#components/task/create-task-modal-fields'
import { PlanTabStrip } from '#components/task/plan-tab-strip'
import { SidebarField } from '#components/task/sidebar-field'
import type { TaskPriority } from '#hooks/use-priority-settings'
import { useTaskPlan } from '#hooks/use-queues'
import { useUpdateTask } from '#hooks/use-tasks'
import { formatLocalDate } from '#lib/date-range'
import { ordinal } from '#lib/format'

export function SidebarPlanField({
  taskId,
  priority,
}: {
  taskId: string
  priority: TaskPriority
}) {
  const date = useMemo(() => formatLocalDate(new Date()), [])
  const { plan, position, setPlan, isLoading } = useTaskPlan(taskId, date)
  const updateTask = useUpdateTask()

  const handleChange = (next: PlanValue | '') => {
    setPlan(next)
    if (next !== '' && priority === null) {
      updateTask.mutate({ id: taskId, input: { priority: 0 } })
    }
  }

  return (
    <SidebarField label="PLAN">
      <PlanTabStrip value={plan} onChange={handleChange} disabled={isLoading} />
      {position != null && (
        <p className="mt-1 text-2xs text-muted-foreground-faint">
          in {plan === 'day' ? "today's" : "this week's"} queue ·{' '}
          {ordinal(position.index + 1)} of {position.total}
        </p>
      )}
    </SidebarField>
  )
}
