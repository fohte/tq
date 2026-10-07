import type { LabelFilter } from '#hooks/use-labels'
import type { ProjectFilter } from '#hooks/use-projects'
import type { RecurringTemplateFilter } from '#hooks/use-recurring-templates'
import type { SavedViewFilter } from '#hooks/use-saved-views'
import type { TaskListFilter } from '#hooks/use-task-queries'
import { isRecord } from '#lib/type-guards'

// infiniteLists deliberately isn't nested under `lists`: use-task-mutations.ts
// runs optimistic updates against every `lists`-prefixed cache entry assuming
// each holds a Task[], but an infinite query's cache entry is an InfiniteData
// object instead, so a shared prefix would make those updates throw.
export const taskKeys = {
  all: ['tasks'] as const,
  lists: ['tasks', 'list'] as const,
  list: (filter?: TaskListFilter) => [...taskKeys.lists, filter] as const,
  infiniteLists: ['tasks', 'infinite-list'] as const,
  infiniteList: (filter?: TaskListFilter) =>
    [...taskKeys.infiniteLists, filter] as const,
  details: ['tasks', 'detail'] as const,
  detail: (id: string) => [...taskKeys.details, id] as const,
  labelCountsPrefix: ['tasks', 'label-counts'] as const,
  labelCounts: (context: NonNullable<LabelFilter['context']>) =>
    [...taskKeys.labelCountsPrefix, context] as const,
}

export const taskChecklistKeys = {
  all: (taskId: string) => [...taskKeys.detail(taskId), 'checklists'] as const,
}

export const projectKeys = {
  all: ['projects'] as const,
  lists: ['projects', 'list'] as const,
  list: (filter?: ProjectFilter) => [...projectKeys.lists, filter] as const,
  detail: (id: string) => [...projectKeys.all, 'detail', id] as const,
  taskIds: (id: string) => [...projectKeys.detail(id), 'task-ids'] as const,
}

export const queueKeys = {
  all: ['queues'] as const,
  // Broad queue invalidations should not repeat this date-scoped write.
  carryOver: (date: string) => ['queue-carry-over', date] as const,
  items: (key: string, date: string) =>
    [...queueKeys.all, key, 'items', date] as const,
}

export const timeBlockKeys = {
  all: ['time-blocks'] as const,
  list: (startDate: string, endDate: string) =>
    [...timeBlockKeys.all, 'list', { startDate, endDate }] as const,
}

export const gcalCalendarsKeys = {
  list: (accountId: string) => ['gcal-calendars', accountId] as const,
}

// Nested under `taskKeys.all` so task invalidation refreshes GitHub previews.
const githubUrlPreviewKeyPrefix = [
  ...taskKeys.all,
  'github-url-preview',
] as const

const mentionSuggestionsKeyPrefix = [
  ...taskKeys.all,
  'mention-suggestions',
] as const

export const githubUrlPreviewKeys = {
  preview: (url: string) => [...githubUrlPreviewKeyPrefix, url] as const,
}

export const labelKeys = {
  all: ['labels'] as const,
  list: (filter?: LabelFilter) => [...labelKeys.all, filter] as const,
}

// A null result must not share the non-null project detail cache.
const projectUrlPreviewKeyPrefix = [
  ...projectKeys.all,
  'project-url-preview',
] as const

export const projectUrlPreviewKeys = {
  preview: (id: string) => [...projectUrlPreviewKeyPrefix, id] as const,
}

export const savedViewKeys = {
  all: ['saved-views'] as const,
  lists: ['saved-views', 'list'] as const,
  list: (filter?: SavedViewFilter) => [...savedViewKeys.lists, filter] as const,
}

export const scheduleKeys = {
  all: ['schedules'] as const,
  lists: ['schedules', 'list'] as const,
  list: (startDate: string, endDate: string) =>
    [...scheduleKeys.lists, { startDate, endDate }] as const,
}

export const recurringTemplateKeys = {
  all: ['recurring-templates'] as const,
  lists: ['recurring-templates', 'list'] as const,
  list: (filter?: RecurringTemplateFilter) =>
    [...recurringTemplateKeys.lists, filter] as const,
  detail: (id: string) => [...recurringTemplateKeys.all, 'detail', id] as const,
}

export const descriptionTemplateKeys = {
  all: ['description-templates'] as const,
  lists: ['description-templates', 'list'] as const,
  list: () => descriptionTemplateKeys.lists,
}

export const githubSyncRuleKeys = {
  list: ['github-sync-rules'] as const,
}

export type SearchContext = 'work' | 'personal'

export const searchKeys = {
  all: ['search'] as const,
  results: (q: string, context: SearchContext | undefined) =>
    [...searchKeys.all, 'results', q, context] as const,
  number: (number: string | undefined) =>
    [...searchKeys.all, 'number', number] as const,
  pages: (q: string) => [...searchKeys.all, 'pages', q] as const,
  suggestions: (prefix: string) =>
    [...searchKeys.all, 'suggestions', prefix] as const,
}

export const activityKeys = {
  all: (taskId: string) => [...taskKeys.all, taskId, 'activity'] as const,
}

export const commentKeys = {
  all: (taskId: string) => [...taskKeys.all, taskId, 'comments'] as const,
}

// Mention previews share the task namespace so task invalidation refreshes them.
const mentionPreviewKeyPrefix = [...taskKeys.all, 'mention-preview'] as const

export const taskMentionKeys = {
  preview: (number: number) => [...mentionPreviewKeyPrefix, number] as const,
  suggestionsPrefix: mentionSuggestionsKeyPrefix,
  suggestions: (query: string) =>
    [...mentionSuggestionsKeyPrefix, query] as const,
}

// A null result must not share the non-null task detail cache.
const taskUrlPreviewKeyPrefix = [...taskKeys.all, 'task-url-preview'] as const

export const taskUrlPreviewKeys = {
  preview: (id: string) => [...taskUrlPreviewKeyPrefix, id] as const,
}

function hasQueryKeyPrefix(
  queryKey: readonly unknown[],
  prefix: readonly unknown[],
): boolean {
  return prefix.every((part, index) => queryKey[index] === part)
}

function taskIdFromData(data: unknown): string | null {
  if (!isRecord(data)) return null
  if (typeof data['id'] === 'string') return data['id']
  const task = data['task']
  return isRecord(task) && typeof task['id'] === 'string' ? task['id'] : null
}

function matchesTaskPreview(
  data: unknown,
  taskIds: ReadonlySet<string>,
  includeUnresolvedPreviews: boolean,
): boolean {
  const taskId = taskIdFromData(data)
  return taskId == null ? includeUnresolvedPreviews : taskIds.has(taskId)
}

function isTaskNumber(value: unknown): boolean {
  return typeof value === 'string' && /^\d+$/.test(value)
}

export function matchesTaskSpecificQuery(
  queryKey: readonly unknown[],
  data: unknown,
  taskIds: ReadonlySet<string>,
  includeUnresolvedPreviews: boolean,
): boolean {
  if (hasQueryKeyPrefix(queryKey, taskKeys.details)) {
    const taskId = queryKey[taskKeys.details.length]
    return typeof taskId === 'string' && taskIds.has(taskId)
  }

  if (
    queryKey[0] === taskKeys.all[0] &&
    (queryKey[2] === 'comments' || queryKey[2] === 'activity')
  ) {
    const taskId = queryKey[1]
    return typeof taskId === 'string' && taskIds.has(taskId)
  }

  if (hasQueryKeyPrefix(queryKey, mentionPreviewKeyPrefix)) {
    return matchesTaskPreview(data, taskIds, includeUnresolvedPreviews)
  }

  if (hasQueryKeyPrefix(queryKey, taskUrlPreviewKeyPrefix)) {
    const taskId = queryKey[taskUrlPreviewKeyPrefix.length]
    if (typeof taskId === 'string' && taskIds.has(taskId)) return true
    const dataTaskId = taskIdFromData(data)
    if (dataTaskId != null) return taskIds.has(dataTaskId)
    return includeUnresolvedPreviews && isTaskNumber(taskId)
  }

  if (hasQueryKeyPrefix(queryKey, githubUrlPreviewKeyPrefix)) {
    return matchesTaskPreview(data, taskIds, includeUnresolvedPreviews)
  }

  return false
}
