import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { makeMemo } from '#hooks/memo-test-fixtures'
import { useMemos, useUpdateMemo } from '#hooks/use-memos'

const { mockGet, mockPut } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPut: vi.fn(),
}))

vi.mock('#lib/api', () => ({
  api: {
    api: {
      memos: { ':context': { $get: mockGet, $put: mockPut } },
    },
  },
}))

let queryClient: QueryClient

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

function makeDeferred<T>() {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function memoResponse(memo: ReturnType<typeof makeMemo>) {
  return {
    status: 200,
    ok: true,
    json: () => Promise.resolve(memo),
  }
}

function contextSwitchState(
  putCalls: unknown,
  activeMemo: unknown,
  workMemo: unknown,
  personalMemo: unknown,
) {
  return { putCalls, activeMemo, workMemo, personalMemo }
}

function staleRefetchState(
  memo: unknown,
  getCalls: unknown,
  putCalls: unknown,
) {
  return { memo, getCalls, putCalls }
}

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  })
  mockGet.mockReset()
  mockPut.mockReset()
})

afterEach(() => {
  queryClient.clear()
})

describe('useUpdateMemo', () => {
  it('keeps the pending memo context when the active context changes', async () => {
    const workMemo = makeMemo({ content: 'Work before', revision: 2 })
    const personalMemo = makeMemo({
      context: 'personal',
      content: 'Personal note',
      revision: 7,
    })
    const updatedWorkMemo = makeMemo({ content: 'Work after', revision: 3 })
    const pendingPut = makeDeferred<ReturnType<typeof memoResponse>>()
    mockGet.mockImplementation(({ param }: { param: { context: string } }) =>
      Promise.resolve(
        memoResponse(param.context === 'work' ? workMemo : personalMemo),
      ),
    )
    mockPut.mockReturnValue(pendingPut.promise)

    const { result, rerender } = renderHook(
      ({ context }: { context: 'work' | 'personal' }) => ({
        memo: useMemos(context, false),
        workMemo: useMemos('work', true),
        personalMemo: useMemos('personal', true),
        updateMemo: useUpdateMemo(),
      }),
      { wrapper, initialProps: { context: 'work' } },
    )

    await waitFor(() => {
      expect(
        Object.values({
          work: result.current.workMemo.data,
          personal: result.current.personalMemo.data,
        }),
      ).toEqual([workMemo, personalMemo])
    })

    let mutationPromise: Promise<ReturnType<typeof makeMemo>>
    act(() => {
      mutationPromise = result.current.updateMemo.mutateAsync({
        context: 'work',
        input: {
          content: 'Work after',
          revision: 2,
          readCurrentDraft: () => 'Work after',
        },
      })
    })

    await waitFor(() => {
      expect(mockPut.mock.calls.length).toBe(1)
    })
    rerender({ context: 'personal' })
    pendingPut.resolve(memoResponse(updatedWorkMemo))
    await act(async () => {
      await mutationPromise
    })

    expect(
      contextSwitchState(
        mockPut.mock.calls,
        result.current.memo.data,
        result.current.workMemo.data,
        result.current.personalMemo.data,
      ),
    ).toEqual(
      contextSwitchState(
        [
          [
            {
              param: { context: 'work' },
              json: { content: 'Work after', revision: 2 },
            },
          ],
        ],
        personalMemo,
        updatedWorkMemo,
        personalMemo,
      ),
    )
  })

  it('keeps the mutation result when a refetch started earlier completes afterward', async () => {
    const initialMemo = makeMemo({ content: 'Initial note', revision: 1 })
    const updatedMemo = makeMemo({ content: 'Saved note', revision: 2 })
    const staleMemo = makeMemo({ content: 'Stale note', revision: 1 })
    const pendingStaleGet = makeDeferred<ReturnType<typeof memoResponse>>()
    mockGet
      .mockResolvedValueOnce(memoResponse(initialMemo))
      .mockReturnValueOnce(pendingStaleGet.promise)
    mockPut.mockResolvedValue(memoResponse(updatedMemo))

    const { result } = renderHook(
      () => ({ memo: useMemos('work', true), updateMemo: useUpdateMemo() }),
      { wrapper },
    )

    await waitFor(() => {
      expect(result.current.memo.data).toEqual(initialMemo)
    })
    let staleRefetch: ReturnType<typeof result.current.memo.refetch>
    act(() => {
      staleRefetch = result.current.memo.refetch()
    })
    await waitFor(() => {
      expect(mockGet.mock.calls.length).toBe(2)
    })

    await act(async () => {
      await result.current.updateMemo.mutateAsync({
        context: 'work',
        input: {
          content: 'Saved note',
          revision: 1,
          readCurrentDraft: () => 'Saved note',
        },
      })
    })
    pendingStaleGet.resolve(memoResponse(staleMemo))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
      await staleRefetch
    })

    expect(
      staleRefetchState(
        result.current.memo.data,
        mockGet.mock.calls,
        mockPut.mock.calls,
      ),
    ).toEqual(
      staleRefetchState(
        updatedMemo,
        [[{ param: { context: 'work' } }], [{ param: { context: 'work' } }]],
        [
          [
            {
              param: { context: 'work' },
              json: { content: 'Saved note', revision: 1 },
            },
          ],
        ],
      ),
    )
  })
})
