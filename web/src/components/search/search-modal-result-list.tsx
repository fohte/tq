import { Fragment, type RefObject, useRef } from 'react'

import type { ListItem } from '#components/search/search-modal-result-items'

export interface ResultGroup {
  id: string
  title: string
  items: ListItem[]
  isVisible: (query: string, itemCount: number) => boolean
}

export interface IndexedResultGroup extends Omit<ResultGroup, 'items'> {
  items: { item: ListItem; globalIndex: number }[]
}

export function indexResultGroups(groups: ResultGroup[]): {
  items: ListItem[]
  indexedGroups: IndexedResultGroup[]
} {
  let globalIndex = 0
  const indexedGroups = groups.map((group) => ({
    ...group,
    items: group.items.map((item) => ({
      item,
      globalIndex: globalIndex++,
    })),
  }))

  return {
    indexedGroups,
    items: indexedGroups.flatMap((group) =>
      group.items.map(({ item }) => item),
    ),
  }
}

export function SearchModalResultList({
  groups,
  listRef,
  selectedIndex,
  onSelectedIndexChange,
  emptyMessage,
  initialMessage,
}: {
  groups: IndexedResultGroup[]
  listRef: RefObject<HTMLDivElement | null>
  selectedIndex: number
  onSelectedIndexChange: (index: number) => void
  emptyMessage?: string
  initialMessage?: string
}) {
  const lastMousePos = useRef({ x: 0, y: 0 })

  return (
    <div
      ref={listRef}
      className="flex-1 overflow-y-auto py-2"
      role="listbox"
      aria-label="Search results"
    >
      {emptyMessage != null && (
        <div className="px-4 py-8 text-center font-mono text-xs text-muted-foreground-faint">
          {emptyMessage}
        </div>
      )}

      {groups.map((group, groupIndex) => (
        <Fragment key={group.id}>
          {groupIndex > 0 && <div className="mx-4 my-1 h-px bg-border" />}
          <div className="px-4 py-1 font-mono text-2xs tracking-widest text-muted-foreground-faint">
            {group.title}
          </div>
          {group.items.map(({ item, globalIndex }) => (
            <Fragment key={item.key}>
              {item.render({
                isSelected: selectedIndex === globalIndex,
                onMouseMove: (event) => {
                  if (
                    event.clientX !== lastMousePos.current.x ||
                    event.clientY !== lastMousePos.current.y
                  ) {
                    lastMousePos.current = {
                      x: event.clientX,
                      y: event.clientY,
                    }
                    onSelectedIndexChange(globalIndex)
                  }
                },
              })}
            </Fragment>
          ))}
        </Fragment>
      ))}

      {initialMessage != null && (
        <div className="px-4 py-8 text-center font-mono text-xs text-muted-foreground-faint">
          {initialMessage}
        </div>
      )}
    </div>
  )
}
