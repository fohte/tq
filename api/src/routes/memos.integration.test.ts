import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { app } from '#app'
import { jsonBody, setupTestDb } from '#testing'

setupTestDb()

const memoResponseSchema = z.object({
  context: z.enum(['work', 'personal']),
  content: z.string(),
  revision: z.number(),
  updatedAt: z.iso.datetime().nullable(),
})

async function memoResponse(response: Response) {
  const body = await jsonBody(response, memoResponseSchema)
  return {
    status: response.status,
    body: {
      ...body,
      updatedAt: body.updatedAt == null ? null : '<timestamp>',
    },
  }
}

type MemoSummary = Awaited<ReturnType<typeof memoResponse>>

function contextMemos(work: MemoSummary, personal: MemoSummary) {
  return { work, personal }
}

function updatedContextMemo(update: MemoSummary, personal: MemoSummary) {
  return { update, personal }
}

function memoConflict(
  first: MemoSummary,
  stale: { status: number; body: { error: string } },
  current: MemoSummary,
) {
  return { first, stale, current }
}

async function updateMemo(
  context: 'work' | 'personal',
  content: string,
  revision: number,
) {
  return app.request(`/api/memos/${context}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, revision }),
  })
}

describe('memos API', () => {
  it('returns an empty memo at revision zero for each context', async () => {
    const work = await memoResponse(await app.request('/api/memos/work'))
    const personal = await memoResponse(
      await app.request('/api/memos/personal'),
    )

    expect(contextMemos(work, personal)).toEqual({
      work: {
        status: 200,
        body: {
          context: 'work',
          content: '',
          revision: 0,
          updatedAt: null,
        },
      },
      personal: {
        status: 200,
        body: {
          context: 'personal',
          content: '',
          revision: 0,
          updatedAt: null,
        },
      },
    })
  })

  it('updates only the selected context and advances its revision', async () => {
    const update = await memoResponse(
      await updateMemo('work', 'An idea to revisit', 0),
    )
    const personal = await memoResponse(
      await app.request('/api/memos/personal'),
    )

    expect(updatedContextMemo(update, personal)).toEqual({
      update: {
        status: 200,
        body: {
          context: 'work',
          content: 'An idea to revisit',
          revision: 1,
          updatedAt: '<timestamp>',
        },
      },
      personal: {
        status: 200,
        body: {
          context: 'personal',
          content: '',
          revision: 0,
          updatedAt: null,
        },
      },
    })
  })

  it('rejects a stale revision without replacing the current memo', async () => {
    const first = await memoResponse(
      await updateMemo('work', 'Current note', 0),
    )
    const staleResponse = await updateMemo('work', 'Older note', 0)
    const stale = {
      status: staleResponse.status,
      body: await jsonBody(staleResponse, z.object({ error: z.string() })),
    }
    const current = await memoResponse(await app.request('/api/memos/work'))

    expect(memoConflict(first, stale, current)).toEqual({
      first: {
        status: 200,
        body: {
          context: 'work',
          content: 'Current note',
          revision: 1,
          updatedAt: '<timestamp>',
        },
      },
      stale: {
        status: 409,
        body: {
          error: 'Memo has changed; fetch the latest revision before updating',
        },
      },
      current: {
        status: 200,
        body: {
          context: 'work',
          content: 'Current note',
          revision: 1,
          updatedAt: '<timestamp>',
        },
      },
    })
  })

  it('rejects content beyond the markdown length limit', async () => {
    const response = await updateMemo('work', 'a'.repeat(100_001), 0)

    expect(response.status).toEqual(400)
  })
})
