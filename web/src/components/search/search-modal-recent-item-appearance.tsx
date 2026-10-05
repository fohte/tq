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
  ).render({ isSelected, onMouseMove })
}
