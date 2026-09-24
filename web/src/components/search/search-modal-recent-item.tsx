import type { MouseEvent } from 'react'

import type { ListItem } from '#components/search/search-modal-result-items'
import type { RecentSearchItem } from '#lib/recent-search-items'
import { cn } from '#lib/utils'

export function SearchModalRecentItem({
  item,
  isSelected,
  onMouseMove,
  onSelect,
}: {
  item: RecentSearchItem
  isSelected: boolean
  onMouseMove: (event: MouseEvent<HTMLElement>) => void
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      data-selected={isSelected}
      onClick={onSelect}
      onMouseMove={onMouseMove}
      className={cn(
        'flex w-full items-center gap-3 px-4 py-2 text-left',
        isSelected ? 'bg-accent' : 'hover:bg-accent/50',
      )}
    >
      <span className="w-12 shrink-0 font-mono text-2xs text-muted-foreground">
        {item.kind === 'task' ? `#${String(item.number)}` : 'Project'}
      </span>
      <span className="truncate font-mono text-sm text-foreground">
        {item.title}
      </span>
    </button>
  )
}

export function createRecentSearchItems(
  recentItems: RecentSearchItem[],
  openTask: (task: { id: string }) => void,
  openProject: (project: { id: string }) => void,
): ListItem[] {
  return recentItems.map((item) => {
    const select = () => {
      if (item.kind === 'task') {
        openTask(item)
      } else {
        openProject(item)
      }
    }

    return {
      key: `recent:${item.kind}:${item.id}`,
      select,
      render: ({ isSelected, onMouseMove }) => (
        <SearchModalRecentItem
          item={item}
          isSelected={isSelected}
          onMouseMove={onMouseMove}
          onSelect={select}
        />
      ),
    }
  })
}
