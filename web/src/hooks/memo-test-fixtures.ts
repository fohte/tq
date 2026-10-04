import type { Memo } from '#hooks/use-memos'

export function makeMemo(overrides: Partial<Memo> = {}): Memo {
  return {
    context: 'work',
    content: '',
    revision: 0,
    updatedAt: null,
    ...overrides,
  }
}
