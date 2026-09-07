import { useSearch } from '@tanstack/react-router'
import { parseSearchQuery } from 'api/search-query-parser'
import { useState } from 'react'

import { EditLabelDialog } from '#components/label/edit-label-dialog'
import {
  SidebarActionableRow,
  SidebarRowLink,
} from '#components/layout/sidebar-row'
import { useCurrentContext } from '#hooks/use-current-context'
import type { Label } from '#hooks/use-labels'
import { useDeleteLabel, useLabels } from '#hooks/use-labels'
import { useTagCounts } from '#hooks/use-tag-counts'
import type { TagTreeNode } from '#lib/tag-tree'
import { tagFilterSearch } from '#lib/tasks-query'
import { cn } from '#lib/utils'

// Recurses into node.children, rendering each descendant as its own sibling
// row indented one level deeper — the tree has no collapse state, so every
// node is always visible. `node.name` may not have a matching Label (an
// intermediate name synthesized by buildTagTree, e.g. "dev" when only
// "dev/tq" exists), in which case the row links/filters like any tag but
// skips the edit/delete actions since there is no label to act on.
function TagLink({
  node,
  depth,
  labelsByName,
  activeTag,
}: {
  node: TagTreeNode
  depth: number
  labelsByName: Map<string, Label>
  activeTag: string | undefined
}) {
  const [editOpen, setEditOpen] = useState(false)
  const deleteLabel = useDeleteLabel()
  const label = labelsByName.get(node.name)
  const isActive = activeTag === node.name
  const displayName = node.name.slice(node.name.lastIndexOf('/') + 1)

  const rowContent = (
    <>
      <span
        className={cn(
          'font-bold',
          isActive ? 'text-primary' : 'text-muted-foreground-faint',
        )}
      >
        #
      </span>
      <span className="flex-1 truncate text-left">{displayName}</span>
      <span className="shrink-0 text-muted-foreground-faint">{node.count}</span>
    </>
  )

  return (
    <>
      {label == null ? (
        <SidebarRowLink
          search={tagFilterSearch(node.name)}
          isActive={isActive}
          depth={depth}
        >
          {rowContent}
        </SidebarRowLink>
      ) : (
        <>
          <SidebarActionableRow
            search={tagFilterSearch(node.name)}
            isActive={isActive}
            depth={depth}
            actionsAriaLabel="Tag actions"
            editItemLabel="edit…"
            onEdit={() => {
              setEditOpen(true)
            }}
            deleteTitle="Delete tag"
            deleteDescription={`Are you sure you want to delete "#${node.name}"? This action cannot be undone.`}
            onDelete={() => {
              deleteLabel.mutate(label.id)
            }}
          >
            {rowContent}
          </SidebarActionableRow>
          <EditLabelDialog
            label={label}
            open={editOpen}
            onOpenChange={setEditOpen}
          />
        </>
      )}
      {node.children.map((child) => (
        <TagLink
          key={child.name}
          node={child}
          depth={depth + 1}
          labelsByName={labelsByName}
          activeTag={activeTag}
        />
      ))}
    </>
  )
}

export function TagsSection() {
  const context = useCurrentContext()
  const { tagTree } = useTagCounts(context)
  // Same queryKey as the one useTagCounts fetches internally, so this reads
  // from cache rather than issuing a second request.
  const { data: labels } = useLabels({ context })
  // `q` only exists on the /tasks route's search schema, so this reads
  // undefined (no active tag) everywhere else.
  const { q } = useSearch({ strict: false })
  const activeTag = q != null ? parseSearchQuery(q).label : undefined

  const labelsByName = new Map(labels?.map((label) => [label.name, label]))

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-3.5 pb-1.5">
        <span className="font-mono text-2xs tracking-widest text-muted-foreground-faint">
          TAGS
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {tagTree.map((node) => (
          <TagLink
            key={node.name}
            node={node}
            depth={0}
            labelsByName={labelsByName}
            activeTag={activeTag}
          />
        ))}
      </div>
    </div>
  )
}
