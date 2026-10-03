import {
  QueryClientProvider,
  useMutation,
  useQuery,
} from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { createSyncedQueryClient } from '#lib/query-client'

const clients: Array<ReturnType<typeof createSyncedQueryClient>> = []

function createWrapper(
  client: ReturnType<typeof createSyncedQueryClient>['queryClient'],
) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

afterEach(() => {
  for (const { disconnect } of clients) disconnect()
  clients.length = 0
})

describe('createSyncedQueryClient', () => {
  it('refetches sibling queries after a successful mutation', async () => {
    const channelName = `tq:query-sync:${crypto.randomUUID()}`
    const first = createSyncedQueryClient(channelName)
    const second = createSyncedQueryClient(channelName)
    clients.push(first, second)

    let fetchCount = 0
    const queryKey = ['tasks']
    second.queryClient.setQueryData(queryKey, 0)

    const { result: queryResult } = renderHook(
      () =>
        useQuery({
          queryKey,
          queryFn: () => Promise.resolve(++fetchCount),
          staleTime: Infinity,
        }),
      { wrapper: createWrapper(second.queryClient) },
    )
    const { result: mutationResult } = renderHook(
      () => useMutation({ mutationFn: () => Promise.resolve('saved') }),
      { wrapper: createWrapper(first.queryClient) },
    )

    await act(async () => {
      await mutationResult.current.mutateAsync()
    })
    await waitFor(() => {
      expect(queryResult.current.data).toEqual(1)
    })
  })
})
