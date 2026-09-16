import {
  planLabels,
  type PlanValue,
  planValues,
} from '#components/task/create-task-modal-fields'
import { TabStrip } from '#components/ui/tab-strip'

const PLAN_OPTIONS: ReadonlyArray<{ value: PlanValue | ''; label: string }> =
  planValues.map((value) => ({
    value,
    label: value === '' ? '—' : planLabels[value],
  }))

export function PlanTabStrip({
  value,
  onChange,
  disabled,
  className,
}: {
  value: PlanValue | ''
  onChange: (value: PlanValue | '') => void
  disabled?: boolean
  className?: string
}) {
  return (
    <TabStrip
      value={value}
      options={PLAN_OPTIONS}
      onChange={onChange}
      {...(disabled != null ? { disabled } : {})}
      {...(className != null ? { className } : {})}
    />
  )
}
