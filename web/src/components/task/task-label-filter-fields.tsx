import { FilterOptionButton } from '#components/ui/filter-option-button'
import { useLabels } from '#hooks/use-labels'

// Self-fetches the label list (same pattern as ContextFilterInline's own
// useContextFilter call) so callers don't have to thread label data through
// props just to render this in two places (an applied `label` chip's own
// menu and the `+ filter` panel's LABEL section).
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
