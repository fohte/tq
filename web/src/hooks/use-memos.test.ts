import { describe, expect, it } from 'vitest'

import { makeMemo } from '#hooks/memo-test-fixtures'
import {
  type MemoContext,
  saveMemoWithConflictResolution,
} from '#hooks/use-memos'

describe('saveMemoWithConflictResolution', () => {
  it('appends the current draft to the latest memo and saves with its revision after a conflict', async () => {
    const requests: Array<{
      method: 'GET' | 'PUT'
      context: MemoContext
      content?: string
      revision?: number
    }> = []
    const transport = {
      read: (context: MemoContext) => {
        requests.push({ method: 'GET', context })
        return Promise.resolve(
          makeMemo({ content: 'An idea from dot', revision: 4 }),
        )
      },
      update: (
        context: MemoContext,
        input: { content: string; revision: number },
      ) => {
        requests.push({ method: 'PUT', context, ...input })
        if (input.revision === 2)
          return Promise.resolve({ status: 409 as const })
        return Promise.resolve({
          status: 200 as const,
          memo: makeMemo({ ...input, revision: input.revision + 1 }),
        })
      },
    }
    const result = await saveMemoWithConflictResolution(
      'work',
      {
        content: 'My unsaved note',
        revision: 2,
        readCurrentDraft: () => 'My unsaved note, with a newer edit',
      },
      transport,
    )
    const actual = result.match(
      (memo) => ({ result: memo, requests }),
      (error) => ({ error: error.message, requests }),
    )

    const expected = {
      result: makeMemo({
        content: 'An idea from dot\n\nMy unsaved note, with a newer edit',
        revision: 5,
      }),
      requests: [
        {
          method: 'PUT',
          context: 'work',
          content: 'My unsaved note',
          revision: 2,
        },
        { method: 'GET', context: 'work' },
        {
          method: 'PUT',
          context: 'work',
          content: 'An idea from dot\n\nMy unsaved note, with a newer edit',
          revision: 4,
        },
      ],
    }
    expect(actual).toEqual(expected)
  })
})
