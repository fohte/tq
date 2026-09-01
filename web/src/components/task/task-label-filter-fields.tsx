import { FilterOptionButton } from '#components/ui/filter-option-button'
import { useLabels } from '#hooks/use-labels'

export function TaskLabelFilterFields({
  selectedLabel,
  onLabelChange,
}: {
  selectedLabel: string | undefined
  onLabelChange: (label: string | undefined) => void
}) {
  const { data: labelsData } = useLabels()
  const labels = labelsData ?? []

  return (
    <div>
      <FilterOptionButton
        active={selectedLabel == null}
        onClick={() => {
          onLabelChange(undefined)
        }}
      >
        No label
      </FilterOptionButton>
      {labels.map((label) => (
        <FilterOptionButton
          key={label.name}
          active={selectedLabel === label.name}
          onClick={() => {
            onLabelChange(label.name)
          }}
        >
          #{label.name}
        </FilterOptionButton>
      ))}
    </div>
  )
}
