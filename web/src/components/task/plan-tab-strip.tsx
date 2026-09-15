import {
  planLabels,
  type PlanValue,
} from '#components/task/create-task-modal-fields'
import { TabStrip } from '#components/ui/tab-strip'

const PLAN_OPTIONS: ReadonlyArray<{ value: PlanValue | ''; label: string }> = [
  { value: '', label: '—' },
  { value: 'day', label: planLabels.day },
  { value: 'week', label: planLabels.week },
]

export function PlanTabStrip({
  value,
  onChange,
  className,
}: {
  value: PlanValue | ''
  onChange: (value: PlanValue | '') => void
  className?: string
}) {
  return (
    <TabStrip
      value={value}
      options={PLAN_OPTIONS}
      onChange={onChange}
      {...(className != null ? { className } : {})}
    />
  )
}
