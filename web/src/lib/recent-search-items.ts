import { getStorageItem, parseJson, setStorageItem } from '#lib/local-storage'

const STORAGE_KEY = 'tq:recent-search-items'
const MAX_ITEMS_PER_KIND = 5

export interface RecentTask {
  kind: 'task'
  id: string
  title: string
  number: number
  viewedAt: number
}

export interface RecentProject {
  kind: 'project'
  id: string
  title: string
  viewedAt: number
}

export type RecentSearchItem = RecentTask | RecentProject
export type RecentSearchItemInput =
  Omit<RecentTask, 'viewedAt'> | Omit<RecentProject, 'viewedAt'>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isRecentSearchItem(value: unknown): value is RecentSearchItem {
  if (!isRecord(value)) return false

  const kind = value['kind']
  const id = value['id']
  const title = value['title']
  const viewedAt = value['viewedAt']
  if (
    typeof id !== 'string' ||
    typeof title !== 'string' ||
    typeof viewedAt !== 'number'
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

function isRecentSearchItems(value: unknown): value is RecentSearchItem[] {
  return Array.isArray(value) && value.every(isRecentSearchItem)
}

export function getRecentSearchItems(): RecentSearchItem[] {
  const raw = getStorageItem(STORAGE_KEY).unwrapOr(null)
  if (raw == null) return []

  return parseJson(raw)
    .map((value) => (isRecentSearchItems(value) ? value : []))
    .unwrapOr([])
    .sort((a, b) => b.viewedAt - a.viewedAt)
}

export function recordRecentSearchItem(item: RecentSearchItemInput) {
  const updated = [
    { ...item, viewedAt: Date.now() },
    ...getRecentSearchItems().filter(
      (recent) => recent.kind !== item.kind || recent.id !== item.id,
    ),
  ]
  let taskCount = 0
  let projectCount = 0
  const limited = updated.filter((recent) => {
    if (recent.kind === 'task') {
      taskCount += 1
      return taskCount <= MAX_ITEMS_PER_KIND
    }
    projectCount += 1
    return projectCount <= MAX_ITEMS_PER_KIND
  })

  setStorageItem(STORAGE_KEY, JSON.stringify(limited)).unwrapOr(undefined)
}
