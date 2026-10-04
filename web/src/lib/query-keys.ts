import type { LabelFilter } from '#hooks/use-labels'
import type { ProjectFilter } from '#hooks/use-projects'
import type { SavedViewFilter } from '#hooks/use-saved-views'
import type { TaskListFilter } from '#hooks/use-task-queries'

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
  detail: (id: string) => [...taskKeys.all, 'detail', id] as const,
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
  suggestions: (query: string) =>
    [...taskKeys.all, 'mention-suggestions', query] as const,
}

// A null result must not share the non-null task detail cache.
const taskUrlPreviewKeyPrefix = [...taskKeys.all, 'task-url-preview'] as const

export const taskUrlPreviewKeys = {
  preview: (id: string) => [...taskUrlPreviewKeyPrefix, id] as const,
}
