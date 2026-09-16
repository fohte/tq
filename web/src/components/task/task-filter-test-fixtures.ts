import type { ParsedQuery } from 'api/search-query-parser'

export function makeParsedQuery(
  overrides: Partial<ParsedQuery> = {},
): ParsedQuery {
  return {
    freeText: '',
    status: ['todo'],
    sortBy: 'updated',
    ...overrides,
  }
}
