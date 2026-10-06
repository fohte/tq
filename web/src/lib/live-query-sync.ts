import type { QueryClient, QueryFilters } from '@tanstack/react-query'
import { Result } from 'neverthrow'

import {
  labelKeys,
  projectKeys,
  queueKeys,
  taskKeys,
  timeBlockKeys,
} from '#lib/query-keys'
import { getScreenId } from '#lib/screen-id'
import { isRecord } from '#lib/type-guards'

interface ChangeEvent {
  resource: string
  id: string | null
  origin: string | null
}

interface EventStream {
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
  ): void
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
  ): void
  onopen: ((event: Event) => void) | null
  onerror: ((event: Event) => void) | null
  close(): void
}

type EventSourceFactory = (url: string) => EventStream

interface LiveQuerySyncOptions {
  origin?: string
  createEventSource?: EventSourceFactory
  checkSession?: () => Promise<unknown>
}

function parseChangeEvent(raw: string): ChangeEvent | null {
  const parsed = Result.fromThrowable(
    (data: string) => JSON.parse(data) as unknown,
    () => null,
  )(raw).unwrapOr(null)
  if (!isRecord(parsed) || typeof parsed['resource'] !== 'string') return null

  const id = parsed['id']
  const origin = parsed['origin']
  return {
    resource: parsed['resource'],
    id: typeof id === 'string' ? id : null,
    origin: typeof origin === 'string' ? origin : null,
  }
}

function filtersForResourceChange({
  resource,
}: ChangeEvent): QueryFilters[] | null {
  switch (resource) {
    case 'task':
      return [
        { queryKey: taskKeys.all },
        { queryKey: projectKeys.all },
        { queryKey: queueKeys.all },
      ]
    case 'project':
      return [{ queryKey: projectKeys.all }]
    case 'label':
      return [{ queryKey: labelKeys.all }, { queryKey: taskKeys.all }]
    case 'queue':
      return [{ queryKey: queueKeys.all }]
    case 'time_block':
      return [{ queryKey: timeBlockKeys.all }, { queryKey: taskKeys.all }]
    case 'schedule':
      return [{ queryKey: ['schedules'] }]
    case 'saved_view':
      return [{ queryKey: ['saved-views'] }]
    case 'description_template':
      return [{ queryKey: ['description-templates'] }]
    case 'recurring_task_template':
      return [{ queryKey: ['recurring-templates'] }]
    case 'github_sync_rule':
      return [{ queryKey: ['github-sync-rules'] }]
    default:
      return null
  }
}

function invalidate(queryClient: QueryClient, filters: QueryFilters[]): void {
  for (const filtersForQuery of filters) {
    void queryClient.invalidateQueries(filtersForQuery)
  }
}

async function checkSession(): Promise<unknown> {
  const { api } = await import('#lib/api')
  return api.api.tasks.$get({ query: { limit: '1' } })
}

export function connectLiveQuerySync(
  queryClient: QueryClient,
  options: LiveQuerySyncOptions = {},
): () => void {
  const origin = options.origin ?? getScreenId()
  const createEventSource =
    options.createEventSource ?? ((url: string) => new EventSource(url))
  const requestSessionCheck = options.checkSession ?? checkSession
  const eventSource = createEventSource('/api/events')
  const pendingFilters = new Map<string, QueryFilters>()
  let pendingAll = false
  let hasConnected = false
  let sessionCheckRequested = false

  const flushPendingInvalidations = () => {
    if (queryClient.isMutating() > 0) return
    if (pendingAll) {
      pendingAll = false
      pendingFilters.clear()
      void queryClient.invalidateQueries()
      return
    }

    const filters = [...pendingFilters.values()]
    pendingFilters.clear()
    invalidate(queryClient, filters)
  }

  const queueInvalidation = (filters: QueryFilters[] | null) => {
    if (filters == null) {
      pendingAll = true
      pendingFilters.clear()
    } else if (!pendingAll) {
      for (const filter of filters) {
        pendingFilters.set(JSON.stringify(filter), filter)
      }
    }
    flushPendingInvalidations()
  }

  const onChange = (event: Event) => {
    const raw = 'data' in event ? event.data : null
    if (typeof raw !== 'string') {
      queueInvalidation(null)
      return
    }

    const change = parseChangeEvent(raw)
    if (change == null) {
      queueInvalidation(null)
      return
    }
    if (change.origin === origin) return

    queueInvalidation(filtersForResourceChange(change))
  }

  const onOpen = () => {
    if (hasConnected) queueInvalidation(null)
    hasConnected = true
    sessionCheckRequested = false
  }

  const onError = () => {
    if (sessionCheckRequested) return
    sessionCheckRequested = true
    void requestSessionCheck().catch(() => undefined)
  }

  const unsubscribeFromMutations = queryClient
    .getMutationCache()
    .subscribe(flushPendingInvalidations)
  let disconnected = false

  eventSource.addEventListener('change', onChange)
  eventSource.onopen = onOpen
  eventSource.onerror = onError

  return () => {
    if (disconnected) return
    disconnected = true
    unsubscribeFromMutations()
    eventSource.removeEventListener('change', onChange)
    eventSource.onopen = null
    eventSource.onerror = null
    eventSource.close()
  }
}
