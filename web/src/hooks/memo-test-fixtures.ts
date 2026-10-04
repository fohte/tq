import type { Memo } from '#hooks/memo-save'

export function makeMemo(overrides: Partial<Memo> = {}): Memo {
  return {
    context: 'work',
    content: '',
    revision: 0,
    updatedAt: null,
    ...overrides,
  }
}
