import {
  QueryClientProvider,
  useMutation,
  useQuery,
} from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { createSyncedQueryClient } from '#lib/synced-query-client'

const clients: Array<ReturnType<typeof createSyncedQueryClient>> = []
const observers: BroadcastChannel[] = []

function createWrapper(
  client: ReturnType<typeof createSyncedQueryClient>['queryClient'],
) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

afterEach(() => {
  for (const { disconnect } of clients) disconnect()
  for (const observer of observers) observer.close()
  clients.length = 0
  observers.length = 0
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

  it('waits for local mutations before applying a sibling invalidation', async () => {
    const channelName = `tq:query-sync:${crypto.randomUUID()}`
    const first = createSyncedQueryClient(channelName)
    const second = createSyncedQueryClient(channelName)
    clients.push(first, second)

    const observer = new BroadcastChannel(channelName)
    observers.push(observer)
    const broadcastReceived = new Promise<void>((resolve) => {
      observer.addEventListener(
        'message',
        () => {
          resolve()
        },
        { once: true },
      )
    })

    let fetchCount = 0
    let mutationIsPending = false
    let refetchedWhileMutationPending = false
    let signalMutationStarted = () => {}
    let finishMutation = () => {}
    const mutationStarted = new Promise<void>((resolve) => {
      signalMutationStarted = resolve
    })
    const queryKey = ['tasks']
    second.queryClient.setQueryData(queryKey, 0)

    const { result: queryResult } = renderHook(
      () =>
        useQuery({
          queryKey,
          queryFn: () => {
            if (mutationIsPending) refetchedWhileMutationPending = true
            return Promise.resolve(++fetchCount)
          },
          staleTime: Infinity,
        }),
      { wrapper: createWrapper(second.queryClient) },
    )
    const { result: localMutationResult } = renderHook(
      () =>
        useMutation({
          mutationFn: () =>
            new Promise<string>((resolve) => {
              mutationIsPending = true
              signalMutationStarted()
              finishMutation = () => {
                mutationIsPending = false
                resolve('saved')
              }
            }),
        }),
      { wrapper: createWrapper(second.queryClient) },
    )
    const { result: remoteMutationResult } = renderHook(
      () => useMutation({ mutationFn: () => Promise.resolve('saved') }),
      { wrapper: createWrapper(first.queryClient) },
    )

    act(() => {
      localMutationResult.current.mutate()
    })
    await mutationStarted
    await act(async () => {
      await remoteMutationResult.current.mutateAsync()
    })
    await broadcastReceived
    await new Promise((resolve) => setTimeout(resolve, 20))
    finishMutation()

    await waitFor(() => {
      expect(
        JSON.stringify([
          queryResult.current.data,
          fetchCount,
          refetchedWhileMutationPending,
        ]),
      ).toBe('[1,1,false]')
    })
  })
})
