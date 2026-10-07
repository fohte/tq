import type { QueryClient, QueryFilters } from '@tanstack/react-query'
import {
  type ChangeEvent,
  type ChangeResource,
  isChangeResource,
} from 'api/lib/change-event-contract'
import { Result } from 'neverthrow'

import {
  descriptionTemplateKeys,
  githubSyncRuleKeys,
  labelKeys,
  projectKeys,
  queueKeys,
  recurringTemplateKeys,
  savedViewKeys,
  scheduleKeys,
  taskKeys,
  timeBlockKeys,
} from '#lib/query-keys'
import { getScreenId } from '#lib/screen-id'
import { isRecord } from '#lib/type-guards'

interface EventStream {
  readyState: number
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

const EVENT_SOURCE_CLOSED = 2
const INITIAL_RECONNECT_DELAY_MS = 1_000
const MAX_RECONNECT_DELAY_MS = 30_000
const INVALIDATION_BATCH_WINDOW_MS = 1_000
const GITHUB_SYNC_QUERY_KEY = 'github-sync'

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
  if (!isRecord(parsed) || !isChangeResource(parsed['resource'])) return null

  const id = parsed['id']
  const origin = parsed['origin']
  return {
    resource: parsed['resource'],
    id: typeof id === 'string' ? id : null,
    origin: typeof origin === 'string' ? origin : null,
  }
}

const resourceQueryFilters: Record<
  ChangeResource,
  (event: ChangeEvent) => QueryFilters[] | null
> = {
  task: () => [
    { queryKey: taskKeys.all },
    { queryKey: projectKeys.all },
    { queryKey: queueKeys.all },
  ],
  project: () => [{ queryKey: projectKeys.all }],
  label: () => [{ queryKey: labelKeys.all }, { queryKey: taskKeys.all }],
  queue: () => [{ queryKey: queueKeys.all }],
  time_block: () => [
    { queryKey: timeBlockKeys.all },
    { queryKey: taskKeys.all },
  ],
  schedule: () => [{ queryKey: scheduleKeys.all }],
  saved_view: () => [{ queryKey: savedViewKeys.all }],
  description_template: () => [{ queryKey: descriptionTemplateKeys.all }],
  recurring_task_template: () => [{ queryKey: recurringTemplateKeys.all }],
  github_sync_rule: () => [{ queryKey: githubSyncRuleKeys.list }],
  agent_session: () => [
    { queryKey: ['agent-sessions'] },
    { queryKey: taskKeys.all },
  ],
  checklist: () => [{ queryKey: taskKeys.all }],
  checklist_item: () => [{ queryKey: taskKeys.all }],
  scheduling_setting: () => [{ queryKey: ['scheduling-settings'] }],
  memo: ({ id }) => [{ queryKey: id == null ? ['memos'] : ['memos', id] }],
  push: () => [],
  calendar: () => [
    { queryKey: ['gcal-calendars'] },
    { queryKey: ['gcal-events'] },
  ],
  github: () => [],
  asset: () => [],
  integration: () => [
    { queryKey: ['integrations'] },
    { queryKey: ['gcal-calendars'] },
    { queryKey: ['gcal-events'] },
    { queryKey: ['github-sync'] },
  ],
  unknown: () => null,
}

function filtersForResourceChange(event: ChangeEvent): QueryFilters[] | null {
  return resourceQueryFilters[event.resource](event)
}

function invalidate(queryClient: QueryClient, filters: QueryFilters[]): void {
  for (const filtersForQuery of filters) {
    void queryClient.invalidateQueries(filtersForQuery, {
      cancelRefetch: false,
    })
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
  const pendingFilters = new Map<string, QueryFilters>()
  let pendingAll = false
  let hasConnected = false
  let sessionCheckRequested = false
  let shouldInvalidateOnOpen = false
  let reconnectAttempt = 0
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined
  let invalidationTimer: ReturnType<typeof setTimeout> | undefined
  let waitingForMutation = false
  let disconnected = false
  let eventSource: EventStream

  const clearInvalidationTimer = () => {
    if (invalidationTimer == null) return
    clearTimeout(invalidationTimer)
    invalidationTimer = undefined
  }

  const flushPendingInvalidations = () => {
    if (queryClient.isMutating() > 0) {
      waitingForMutation = true
      return
    }
    waitingForMutation = false
    clearInvalidationTimer()
    if (pendingAll) {
      pendingAll = false
      pendingFilters.clear()
      void queryClient.invalidateQueries(
        {
          predicate: (query) => query.queryKey[0] !== GITHUB_SYNC_QUERY_KEY,
        },
        { cancelRefetch: false },
      )
      return
    }

    const filters = [...pendingFilters.values()]
    pendingFilters.clear()
    invalidate(queryClient, filters)
  }

  const schedulePendingInvalidations = () => {
    if (waitingForMutation || invalidationTimer != null) return
    if (!pendingAll && pendingFilters.size === 0) return
    invalidationTimer = setTimeout(() => {
      invalidationTimer = undefined
      flushPendingInvalidations()
    }, INVALIDATION_BATCH_WINDOW_MS)
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
    schedulePendingInvalidations()
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
    if (hasConnected || shouldInvalidateOnOpen) queueInvalidation(null)
    hasConnected = true
    shouldInvalidateOnOpen = false
    reconnectAttempt = 0
    sessionCheckRequested = false
  }

  const detachEventSource = (source: EventStream) => {
    source.removeEventListener('change', onChange)
    source.onopen = null
    source.onerror = null
    source.close()
  }

  const attachEventSource = () => {
    const source = createEventSource('/api/events')
    eventSource = source
    source.addEventListener('change', onChange)
    source.onopen = onOpen
    source.onerror = () => {
      onError(source)
    }
  }

  const onError = (source: EventStream) => {
    if (disconnected || source !== eventSource) return
    if (!sessionCheckRequested) {
      sessionCheckRequested = true
      void requestSessionCheck().catch(() => undefined)
    }
    if (source.readyState !== EVENT_SOURCE_CLOSED || reconnectTimer != null) {
      return
    }

    shouldInvalidateOnOpen = true
    const delay = Math.min(
      INITIAL_RECONNECT_DELAY_MS * 2 ** reconnectAttempt,
      MAX_RECONNECT_DELAY_MS,
    )
    reconnectAttempt += 1
    reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined
      if (disconnected || source !== eventSource) return
      detachEventSource(source)
      attachEventSource()
    }, delay)
  }

  const unsubscribeFromMutations = queryClient
    .getMutationCache()
    .subscribe(() => {
      if (waitingForMutation && queryClient.isMutating() === 0) {
        flushPendingInvalidations()
      }
    })

  attachEventSource()

  return () => {
    if (disconnected) return
    disconnected = true
    unsubscribeFromMutations()
    clearInvalidationTimer()
    if (reconnectTimer != null) clearTimeout(reconnectTimer)
    detachEventSource(eventSource)
  }
}
