import { projectKeys } from '#hooks/use-projects'
import { taskKeys } from '#hooks/use-task-queries'

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
  list: (filter?: { context?: 'work' | 'personal' }) =>
    [...labelKeys.all, filter] as const,
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
  list: (filter?: { q?: string; context?: 'work' | 'personal' }) =>
    [...savedViewKeys.lists, filter] as const,
}

type SearchContext = 'work' | 'personal'

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
