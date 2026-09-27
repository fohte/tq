import { Fragment, type RefObject, useRef } from 'react'

import type { ListItem } from '#components/search/search-modal-result-items'

interface ResultGroupBase {
  id: string
  title: string
  isVisible: (query: string, itemCount: number) => boolean
}

export type ResultGroup = ResultGroupBase &
  (
    | { items: ListItem[]; sections?: never }
    | { items?: never; sections: ResultSubgroup[] }
  )

interface ResultSubgroup {
  id: string
  title: string
  items: ListItem[]
}

interface IndexedResultSubgroup extends Omit<ResultSubgroup, 'items'> {
  items: IndexedListItem[]
}

export interface IndexedListItem {
  item: ListItem
  globalIndex: number
}

export type IndexedResultGroup = ResultGroupBase &
  (
    | { items: IndexedListItem[]; sections?: never }
    | { items?: never; sections: IndexedResultSubgroup[] }
  )

export function resultGroupItemCount(group: {
  items?: readonly unknown[]
  sections?: { items: readonly unknown[] }[]
}): number {
  return group.sections == null
    ? (group.items?.length ?? 0)
    : group.sections.reduce((count, section) => count + section.items.length, 0)
}

export function indexResultGroups(groups: ResultGroup[]): {
  items: ListItem[]
  indexedGroups: IndexedResultGroup[]
} {
  let globalIndex = 0
  const indexItems = (items: ListItem[]): IndexedListItem[] =>
    items.map((item) => ({
      item,
      globalIndex: globalIndex++,
    }))
  const indexedGroups = groups.map((group): IndexedResultGroup =>
    group.sections == null
      ? { ...group, items: indexItems(group.items) }
      : {
          ...group,
          sections: group.sections.map((section) => ({
            ...section,
            items: indexItems(section.items),
          })),
        },
  )

  return {
    indexedGroups,
    items: indexedGroups.flatMap((group) =>
      group.sections == null
        ? group.items.map(({ item }) => item)
        : group.sections.flatMap((section) =>
            section.items.map(({ item }) => item),
          ),
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
  const renderItem = ({ item, globalIndex }: IndexedListItem) => (
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
  )

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
          {group.sections == null
            ? group.items.map(renderItem)
            : group.sections.map((section) => (
                <Fragment key={section.id}>
                  {section.items.length > 0 && (
                    <>
                      <div className="px-4 pt-2 pb-1 font-mono text-2xs text-muted-foreground-faint">
                        {section.title}
                      </div>
                      {section.items.map(renderItem)}
                    </>
                  )}
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
