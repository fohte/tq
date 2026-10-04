import { SearchModalRecentItem } from '#components/search/search-modal-recent-item-appearance'
import type { ListItem } from '#components/search/search-modal-result-items'
import type { RecentSearchItem } from '#lib/recent-search-items'

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
