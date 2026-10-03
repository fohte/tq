import { MutationCache, QueryClient } from '@tanstack/react-query'

const QUERY_SYNC_CHANNEL = 'tq:query-sync'

function isInvalidateMessage(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    value.type === 'invalidate'
  )
}

export function createSyncedQueryClient(channelName = QUERY_SYNC_CHANNEL) {
  const channel =
    typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined'
      ? new BroadcastChannel(channelName)
      : null

  const queryClient = new QueryClient({
    mutationCache: new MutationCache({
      onSuccess: () => channel?.postMessage({ type: 'invalidate' }),
    }),
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60,
        retry: 1,
      },
    },
  })

  const handleMessage = (event: MessageEvent<unknown>) => {
    if (isInvalidateMessage(event.data)) {
      void queryClient.invalidateQueries()
    }
  }
  channel?.addEventListener('message', handleMessage)

  return {
    queryClient,
    disconnect: () => {
      channel?.removeEventListener('message', handleMessage)
      channel?.close()
    },
  }
}

const { queryClient } = createSyncedQueryClient()

export { queryClient }
