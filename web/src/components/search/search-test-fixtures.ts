import type { PageSearchResult, Suggestion } from '#hooks/use-search'
import type { RecentProject, RecentTask } from '#lib/recent-search-items'

export function makeSuggestion(
  overrides: Partial<Suggestion> = {},
): Suggestion {
  return {
    value: 'is:todo',
    display: 'Todo',
    category: 'is',
    ...overrides,
  }
}

export function makePageSearchResult(
  overrides: Partial<PageSearchResult> = {},
): PageSearchResult {
  return {
    source: 'page',
    taskNumber: 42,
    taskTitle: 'Roadmap task',
    pageId: 'page-001',
    pageTitle: 'Architecture notes',
    snippet: 'The architecture notes mention the search flow.',
    matchCount: 1,
    updatedAt: '2026-03-20T00:00:00.000Z',
    ...overrides,
  }
}

export function makeRecentTask(
  overrides: Partial<RecentTask> = {},
): RecentTask {
  return {
    kind: 'task',
    id: 'recent-task-fixture',
    number: 101,
    title: 'Example task',
    context: 'work',
    viewedAt: 1_800_000_000_000,
    ...overrides,
  }
}

export function makeRecentProject(
  overrides: Partial<RecentProject> = {},
): RecentProject {
  return {
    kind: 'project',
    id: 'recent-project-fixture',
    title: 'Example project',
    context: 'work',
    viewedAt: 1_800_000_000_000,
    ...overrides,
  }
}
