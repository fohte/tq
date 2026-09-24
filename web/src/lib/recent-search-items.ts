import { getStorageItem, parseJson, setStorageItem } from '#lib/local-storage'
import { isRecord } from '#lib/type-guards'

const STORAGE_KEY = 'tq:recent-search-items'
const MAX_ITEMS_PER_KIND = 5

export interface RecentTask {
  kind: 'task'
  id: string
  title: string
  number: number
  context?: 'work' | 'personal'
  viewedAt: number
}

export interface RecentProject {
  kind: 'project'
  id: string
  title: string
  context?: 'work' | 'personal'
  viewedAt: number
}

export type RecentSearchItem = RecentTask | RecentProject
export type RecentSearchItemInput =
  Omit<RecentTask, 'viewedAt'> | Omit<RecentProject, 'viewedAt'>

function isRecentSearchItem(value: unknown): value is RecentSearchItem {
  if (!isRecord(value)) return false

  const kind = value['kind']
  const id = value['id']
  const title = value['title']
  const viewedAt = value['viewedAt']
  const context = value['context']
  if (
    typeof id !== 'string' ||
    typeof title !== 'string' ||
    typeof viewedAt !== 'number' ||
    (context !== undefined && context !== 'work' && context !== 'personal')
  ) {
    return false
  }

  return (
    kind === 'project' ||
    (kind === 'task' &&
      typeof value['number'] === 'number' &&
      Number.isInteger(value['number']))
  )
}

function toRecentSearchItems(value: unknown): RecentSearchItem[] {
  return Array.isArray(value) ? value.filter(isRecentSearchItem) : []
}

export function addRecentSearchItem(
  items: RecentSearchItem[],
  item: RecentSearchItemInput,
  viewedAt: number,
): RecentSearchItem[] {
  const updated = [
    { ...item, viewedAt },
    ...items.filter(
      (recent) => recent.kind !== item.kind || recent.id !== item.id,
    ),
  ]
  let taskCount = 0
  let projectCount = 0
  return updated.filter((recent) => {
    if (recent.kind === 'task') {
      taskCount += 1
      return taskCount <= MAX_ITEMS_PER_KIND
    }
    projectCount += 1
    return projectCount <= MAX_ITEMS_PER_KIND
  })
}

export function getRecentSearchItems(): RecentSearchItem[] {
  const raw = getStorageItem(STORAGE_KEY).unwrapOr(null)
  if (raw == null) return []

  return parseJson(raw)
    .map(toRecentSearchItems)
    .unwrapOr([])
    .sort((a, b) => b.viewedAt - a.viewedAt)
}

export function recordRecentSearchItem(item: RecentSearchItemInput) {
  const recentItems = addRecentSearchItem(
    getRecentSearchItems(),
    item,
    Date.now(),
  )

  setStorageItem(STORAGE_KEY, JSON.stringify(recentItems)).unwrapOr(undefined)
}

export function removeRecentSearchItem(
  kind: RecentSearchItem['kind'],
  id: string,
) {
  const recentItems = getRecentSearchItems().filter(
    (item) => item.kind !== kind || item.id !== id,
  )
  setStorageItem(STORAGE_KEY, JSON.stringify(recentItems)).unwrapOr(undefined)
}
