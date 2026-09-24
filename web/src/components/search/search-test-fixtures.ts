import type { PageSearchResult } from '#hooks/use-search'

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
