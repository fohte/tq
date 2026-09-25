import { buildSearchQuery, parseSearchQuery } from 'api/search-query-parser'

export function parseKanbanFilterQuery(query: string) {
  const parsed = parseSearchQuery(query)
  delete parsed.status
  delete parsed.sortBy
  return parsed
}

export function buildKanbanFilterQuery(query: string): string {
  return buildSearchQuery(parseKanbanFilterQuery(query))
}
