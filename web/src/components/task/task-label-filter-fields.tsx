import { List, ListItem } from '@fohte/ui/list'

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
      <ListItem
        indent={depth}
        selected={selectedLabel === node.name}
        onSelect={() => {
          onLabelChange(node.name)
        }}
      >
        #{displayName}
      </ListItem>
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
    <List>
      <ListItem
        selected={selectedLabel == null}
        onSelect={() => {
          onLabelChange(undefined)
        }}
      >
        No label
      </ListItem>
      {labelTree.map((node) => (
        <LabelOption
          key={node.name}
          node={node}
          depth={0}
          selectedLabel={selectedLabel}
          onLabelChange={onLabelChange}
        />
      ))}
    </List>
  )
}
