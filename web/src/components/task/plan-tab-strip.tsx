import { SegmentedControl } from '@fohte/ui/segmented-control'

import {
  planLabels,
  type PlanValue,
  planValues,
} from '#components/task/create-task-modal-fields'

const PLAN_OPTIONS: ReadonlyArray<{ value: PlanValue | ''; label: string }> =
  planValues.map((value) => ({
    value,
    label: value === '' ? '—' : planLabels[value],
  }))

export function PlanTabStrip({
  value,
  onChange,
  disabled,
}: {
  value: PlanValue | ''
  onChange: (value: PlanValue | '') => void
  disabled?: boolean
}) {
  return (
    <SegmentedControl
      value={value}
      options={PLAN_OPTIONS}
      onValueChange={onChange}
      {...(disabled != null ? { disabled } : {})}
    />
  )
}
