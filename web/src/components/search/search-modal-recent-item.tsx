import {
  createOptionItem,
  type ListItem,
} from '#components/search/search-modal-result-items'
import type { RecentSearchItem } from '#lib/recent-search-items'

export function SearchModalRecentItem({
  item,
  isSelected,
  onMouseMove,
  onSelect,
}: {
  item: RecentSearchItem
  isSelected: boolean
  onMouseMove: Parameters<ListItem['render']>[0]['onMouseMove']
  onSelect: () => void
}) {
  return createOptionItem(
    `recent:${item.kind}:${item.id}`,
    onSelect,
    <>
      <span className="w-12 shrink-0 font-mono text-2xs text-muted-foreground">
        {item.kind === 'task' ? `#${String(item.number)}` : 'Project'}
      </span>
      <span className="truncate font-mono text-sm text-foreground">
        {item.title}
      </span>
    </>,
    { className: 'gap-3' },
  ).render({ isSelected, onMouseMove })
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
