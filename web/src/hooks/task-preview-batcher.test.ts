import type { InferResponseType } from 'hono/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getTaskPreview } from '#hooks/task-preview-batcher'
import type { api } from '#lib/api'

type TaskPreview = InferResponseType<
  typeof api.api.tasks.preview.$get,
  200
>[string]
type PreviewRequest = { query: { ids: string } }
type PreviewResponse = {
  ok: boolean
  json: () => Promise<Record<string, TaskPreview>>
}

const { fetchPreviewRequest } = vi.hoisted(() => ({
  fetchPreviewRequest:
    vi.fn<(request: PreviewRequest) => Promise<PreviewResponse>>(),
}))

vi.mock('#lib/api', () => ({
  api: {
    api: { tasks: { preview: { $get: fetchPreviewRequest } } },
  },
}))

beforeEach(() => {
  fetchPreviewRequest.mockReset()
})

function mockPreviews(previews: Record<string, TaskPreview>) {
  fetchPreviewRequest.mockImplementation(({ query: { ids } }) => {
    const batch = Object.fromEntries(
      ids
        .split(',')
        .flatMap((id) => (previews[id] ? [[id, previews[id]]] : [])),
    )

    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(batch),
    })
  })
}

function getRequestedIds() {
  return fetchPreviewRequest.mock.calls.map(([{ query }]) =>
    query.ids.split(','),
  )
}

function makePreview(id: string, number: number): TaskPreview {
  return {
    id,
    number,
    title: `Task ${String(number)}`,
    status: 'todo',
    statusReason: null,
    description: null,
  }
}

function makeBatcherOutput(
  requests: string[][],
  results: (TaskPreview | null)[],
) {
  return { requests, results }
}

describe('task preview batcher', () => {
  it('batches valid identifiers and shares duplicate lookups', async () => {
    const numberPreview = makePreview(
      '00000000-0000-4000-8000-000000000001',
      12,
    )
    const uuidPreview = makePreview('00000000-0000-4000-8000-000000000002', 34)
    const previews: Record<string, TaskPreview> = {
      '12': numberPreview,
      [uuidPreview.id]: uuidPreview,
    }
    mockPreviews(previews)

    const results = await Promise.all([
      getTaskPreview('12'),
      getTaskPreview('12'),
      getTaskPreview(uuidPreview.id),
    ])

    const actual = makeBatcherOutput(getRequestedIds(), results)

    expect(actual).toEqual({
      requests: [['12', '00000000-0000-4000-8000-000000000002']],
      results: [numberPreview, numberPreview, uuidPreview],
    })
  })

  it('resolves missing and invalid identifiers to null without interrupting valid lookups', async () => {
    const preview = makePreview('00000000-0000-4000-8000-000000000001', 12)
    mockPreviews({ '12': preview })

    const results = await Promise.all([
      getTaskPreview('12'),
      getTaskPreview('999'),
      getTaskPreview('not-a-task-id'),
      getTaskPreview('2147483648'),
    ])

    const actual = makeBatcherOutput(getRequestedIds(), results)

    expect(actual).toEqual({
      requests: [['12', '999']],
      results: [preview, null, null, null],
    })
  })

  it('splits more than one hundred identifiers across requests', async () => {
    mockPreviews({})
    const ids = Array.from({ length: 101 }, (_, index) => String(index + 1))

    await Promise.all(ids.map((id) => getTaskPreview(id)))

    expect(getRequestedIds()).toEqual([ids.slice(0, 100), ids.slice(100)])
  })

  it('rejects every lookup when its batch request fails', async () => {
    const error = new Error('preview request failed')
    fetchPreviewRequest.mockRejectedValue(error)

    const results = await Promise.allSettled([
      getTaskPreview('12'),
      getTaskPreview('12'),
      getTaskPreview('34'),
    ])
    const actual = results.map((result) =>
      result.status === 'fulfilled'
        ? [result.status, result.value]
        : [
            result.status,
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason),
          ],
    )

    expect(actual).toEqual([
      ['rejected', 'preview request failed'],
      ['rejected', 'preview request failed'],
      ['rejected', 'preview request failed'],
    ])
  })
})
