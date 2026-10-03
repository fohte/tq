import { MutationCache, QueryClient } from '@tanstack/react-query'

import { isRecord } from '#lib/type-guards'

const QUERY_SYNC_CHANNEL = 'tq:query-sync'

function isInvalidateMessage(value: unknown): boolean {
  return isRecord(value) && value['type'] === 'invalidate'
}

export function createSyncedQueryClient(channelName = QUERY_SYNC_CHANNEL) {
  const channel =
    typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined'
      ? new BroadcastChannel(channelName)
      : null

  let hasPendingInvalidation = false
  const mutationCache = new MutationCache({
    onSuccess: () => channel?.postMessage({ type: 'invalidate' }),
  })
  const queryClient = new QueryClient({
    mutationCache,
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60,
        retry: 1,
      },
    },
  })

  const unsubscribeFromMutations = mutationCache.subscribe(() => {
    if (hasPendingInvalidation && queryClient.isMutating() === 0) {
      hasPendingInvalidation = false
      void queryClient.invalidateQueries()
    }
  })

  const handleMessage = (event: MessageEvent<unknown>) => {
    if (isInvalidateMessage(event.data)) {
      if (queryClient.isMutating() > 0) {
        hasPendingInvalidation = true
      } else {
        void queryClient.invalidateQueries()
      }
    }
  }
  channel?.addEventListener('message', handleMessage)

  return {
    queryClient,
    disconnect: () => {
      unsubscribeFromMutations()
      channel?.removeEventListener('message', handleMessage)
      channel?.close()
    },
  }
}

const { queryClient } = createSyncedQueryClient()

export { queryClient }
