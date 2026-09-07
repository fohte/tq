import { FilterOptionButton } from '#components/ui/filter-option-button'
import { useCurrentContext } from '#hooks/use-current-context'
import { useLabels } from '#hooks/use-labels'
import type { LabelTreeNode } from '#lib/tag-tree'
import { buildLabelTree } from '#lib/tag-tree'

// Synthesized ancestor nodes (e.g. "dev" when only "dev/tq" exists) have no
// matching Label entity but still filter to their descendants, so they stay
// selectable.
function LabelOption({
  node,
  depth,
  selectedLabel,
  onLabelChange,
}: {
  node: LabelTreeNode
  depth: number
  selectedLabel: string | undefined
  onLabelChange: (label: string | undefined) => void
}) {
  const displayName = node.name.slice(node.name.lastIndexOf('/') + 1)

  return (
    <>
      <FilterOptionButton
        depth={depth}
        active={selectedLabel === node.name}
        onClick={() => {
          onLabelChange(node.name)
        }}
      >
        #{displayName}
      </FilterOptionButton>
      {node.children.map((child) => (
        <LabelOption
          key={child.name}
          node={child}
          depth={depth + 1}
          selectedLabel={selectedLabel}
          onLabelChange={onLabelChange}
        />
      ))}
    </>
  )
}

export function TaskLabelFilterFields({
  selectedLabel,
  onLabelChange,
}: {
  selectedLabel: string | undefined
  onLabelChange: (label: string | undefined) => void
}) {
  const context = useCurrentContext()
  const { data: labelsData } = useLabels({ context })
  const labelTree = buildLabelTree(
    (labelsData ?? []).map((label) => label.name),
  )

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
      {labelTree.map((node) => (
        <LabelOption
          key={node.name}
          node={node}
          depth={0}
          selectedLabel={selectedLabel}
          onLabelChange={onLabelChange}
        />
      ))}
    </div>
  )
}
