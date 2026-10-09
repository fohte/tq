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
  isTaskCandidateListQueryKey,
  labelKeys,
  matchesTaskSpecificQuery,
  projectKeys,
  queueKeys,
  recurringTemplateKeys,
  savedViewKeys,
  scheduleKeys,
  taskKeys,
  taskMentionKeys,
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
const HEARTBEAT_TIMEOUT_MS = 75_000

interface LiveQuerySyncOptions {
  origin?: string
  createEventSource?: EventSourceFactory
  checkSession?: () => Promise<unknown>
}

interface ResourceInvalidation {
  filters: QueryFilters[]
  taskIds?: string[]
  includeUnresolvedPreviews?: boolean
}

function parseChangeEvent(raw: string): ChangeEvent | null {
  const parsed = Result.fromThrowable(
    (data: string) => JSON.parse(data) as unknown,
    () => null,
  )(raw).unwrapOr(null)
  if (!isRecord(parsed) || !isChangeResource(parsed['resource'])) return null

  const id = parsed['id']
  const origin = parsed['origin']
  const taskIds = parsed['taskIds']
  return {
    resource: parsed['resource'],
    id: typeof id === 'string' ? id : null,
    origin: typeof origin === 'string' ? origin : null,
    taskIds:
      Array.isArray(taskIds) &&
      taskIds.every((taskId) => typeof taskId === 'string')
        ? taskIds
        : null,
  }
}

const taskListFilters: QueryFilters[] = [
  { queryKey: taskKeys.lists },
  { queryKey: taskKeys.infiniteLists },
]

function taskInvalidation(
  taskIds: string[] | null,
  includeLists: boolean,
  fallbackFilter: QueryFilters,
): ResourceInvalidation {
  if (taskIds === null) return { filters: [fallbackFilter] }

  return {
    filters: includeLists ? taskListFilters : [],
    taskIds,
  }
}

function withFilters(
  invalidation: ResourceInvalidation,
  options: { before?: QueryFilters[]; after?: QueryFilters[] },
): ResourceInvalidation {
  return {
    ...invalidation,
    filters: [
      ...(options.before ?? []),
      ...invalidation.filters,
      ...(options.after ?? []),
    ],
  }
}

const resourceQueryFilters: Record<
  ChangeResource,
  (event: ChangeEvent) => ResourceInvalidation | null
> = {
  task: ({ taskIds }) => {
    const invalidation = withFilters(
      taskInvalidation(taskIds, true, { queryKey: taskKeys.all }),
      { after: [{ queryKey: projectKeys.all }, { queryKey: queueKeys.all }] },
    )
    if (taskIds == null || taskIds.length === 0) return invalidation

    return withFilters(
      {
        ...invalidation,
        includeUnresolvedPreviews: true,
      },
      {
        after: [
          { queryKey: taskKeys.countPrefix },
          { queryKey: taskKeys.labelCountsPrefix },
          { queryKey: taskMentionKeys.suggestionsPrefix },
        ],
      },
    )
  },
  project: () => ({ filters: [{ queryKey: projectKeys.all }] }),
  label: ({ taskIds }) => {
    const invalidation = taskInvalidation(taskIds, true, {
      queryKey: taskKeys.all,
    })
    return withFilters(invalidation, {
      before: [{ queryKey: labelKeys.all }],
      after:
        taskIds != null && taskIds.length > 0
          ? [{ queryKey: taskKeys.labelCountsPrefix }]
          : [],
    })
  },
  queue: () => ({
    filters: [
      { queryKey: queueKeys.all },
      {
        queryKey: taskKeys.lists,
        predicate: ({ queryKey }) => isTaskCandidateListQueryKey(queryKey),
      },
    ],
  }),
  time_block: ({ taskIds }) =>
    withFilters(
      taskInvalidation(taskIds, false, { queryKey: taskKeys.details }),
      { before: [{ queryKey: timeBlockKeys.all }] },
    ),
  schedule: () => ({ filters: [{ queryKey: scheduleKeys.all }] }),
  saved_view: () => ({ filters: [{ queryKey: savedViewKeys.all }] }),
  description_template: () => ({
    filters: [{ queryKey: descriptionTemplateKeys.all }],
  }),
  recurring_task_template: () => ({
    filters: [{ queryKey: recurringTemplateKeys.all }],
  }),
  github_sync_rule: () => ({
    filters: [{ queryKey: githubSyncRuleKeys.list }],
  }),
  agent_session: ({ taskIds }) =>
    withFilters(
      taskInvalidation(taskIds, false, { queryKey: taskKeys.details }),
      { before: [{ queryKey: ['agent-sessions'] }] },
    ),
  checklist: ({ taskIds }) =>
    taskInvalidation(taskIds, true, { queryKey: taskKeys.all }),
  checklist_item: ({ taskIds }) =>
    taskInvalidation(taskIds, true, { queryKey: taskKeys.all }),
  memo: ({ id }) => ({
    filters: [{ queryKey: id == null ? ['memos'] : ['memos', id] }],
  }),
  push: () => ({ filters: [] }),
  calendar: () => ({
    filters: [{ queryKey: ['gcal-calendars'] }, { queryKey: ['gcal-events'] }],
  }),
  github: () => ({ filters: [] }),
  asset: () => ({ filters: [] }),
  integration: () => ({
    filters: [
      { queryKey: ['integrations'] },
      { queryKey: ['gcal-calendars'] },
      { queryKey: ['gcal-events'] },
    ],
  }),
  unknown: () => null,
}

function filtersForResourceChange(
  event: ChangeEvent,
): ResourceInvalidation | null {
  return resourceQueryFilters[event.resource](event)
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
  const pendingTaskIds = new Set<string>()
  let pendingUnresolvedPreviews = false
  let pendingAll = false
  let hasConnected = false
  let sessionCheckRequested = false
  let shouldInvalidateOnOpen = false
  let reconnectAttempt = 0
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined
  let invalidationTimer: ReturnType<typeof setTimeout> | undefined
  let watchdogTimer: ReturnType<typeof setTimeout> | undefined
  let waitingForMutation = false
  const pendingFetchQueryHashes = new Set<string>()
  let unsubscribeFromPendingFetches: (() => void) | undefined
  let disconnected = false
  let eventSource: EventStream
  let eventSourceListeners:
    { change: EventListener; heartbeat: EventListener } | undefined

  const clearInvalidationTimer = () => {
    if (invalidationTimer == null) return
    clearTimeout(invalidationTimer)
    invalidationTimer = undefined
  }

  const invalidateFilters = (filters: QueryFilters[]) => {
    const queryCache = queryClient.getQueryCache()
    for (const filter of filters) {
      for (const query of queryCache.findAll(filter)) {
        if (query.state.fetchStatus === 'fetching') {
          pendingFetchQueryHashes.add(query.queryHash)
        }
      }
    }

    if (
      pendingFetchQueryHashes.size > 0 &&
      unsubscribeFromPendingFetches == null
    ) {
      unsubscribeFromPendingFetches = queryCache.subscribe(() => {
        const settledQueryHashes = [...pendingFetchQueryHashes].filter(
          (queryHash) =>
            queryCache.get(queryHash)?.state.fetchStatus !== 'fetching',
        )
        if (settledQueryHashes.length === 0) return

        for (const queryHash of settledQueryHashes) {
          pendingFetchQueryHashes.delete(queryHash)
        }
        if (pendingFetchQueryHashes.size === 0) {
          unsubscribeFromPendingFetches?.()
          unsubscribeFromPendingFetches = undefined
        }

        const settledQueryHashSet = new Set(settledQueryHashes)
        void queryClient.invalidateQueries(
          {
            predicate: (query) => settledQueryHashSet.has(query.queryHash),
          },
          { cancelRefetch: false },
        )
      })
    }

    for (const filter of filters) {
      void queryClient.invalidateQueries(filter, { cancelRefetch: false })
    }
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
      invalidateFilters([{}])
      return
    }

    const filters = [...pendingFilters.values()]
    pendingFilters.clear()
    if (pendingTaskIds.size > 0) {
      const taskIds = new Set(pendingTaskIds)
      const includeUnresolvedPreviews = pendingUnresolvedPreviews
      filters.push({
        predicate: (query) =>
          matchesTaskSpecificQuery(
            query.queryKey,
            query.state.data,
            taskIds,
            includeUnresolvedPreviews,
          ),
      })
      pendingTaskIds.clear()
      pendingUnresolvedPreviews = false
    }
    invalidateFilters(filters)
  }

  const schedulePendingInvalidations = () => {
    if (waitingForMutation || invalidationTimer != null) return
    if (!pendingAll && pendingFilters.size === 0 && pendingTaskIds.size === 0) {
      return
    }
    invalidationTimer = setTimeout(() => {
      invalidationTimer = undefined
      flushPendingInvalidations()
    }, INVALIDATION_BATCH_WINDOW_MS)
  }

  const queueInvalidation = (invalidation: ResourceInvalidation | null) => {
    if (invalidation == null) {
      pendingAll = true
      pendingFilters.clear()
      pendingTaskIds.clear()
      pendingUnresolvedPreviews = false
    } else if (!pendingAll) {
      for (const filter of invalidation.filters) {
        pendingFilters.set(JSON.stringify(filter), filter)
      }
      for (const taskId of invalidation.taskIds ?? []) {
        pendingTaskIds.add(taskId)
      }
      pendingUnresolvedPreviews ||=
        invalidation.includeUnresolvedPreviews === true
    }
    schedulePendingInvalidations()
  }

  const clearWatchdogTimer = () => {
    if (watchdogTimer == null) return
    clearTimeout(watchdogTimer)
    watchdogTimer = undefined
  }

  const resetWatchdogTimer = (source: EventStream) => {
    clearWatchdogTimer()
    watchdogTimer = setTimeout(() => {
      watchdogTimer = undefined
      if (disconnected || source !== eventSource) return
      source.close()
      onError(source)
    }, HEARTBEAT_TIMEOUT_MS)
  }

  const onChange = (source: EventStream, event: Event) => {
    if (disconnected || source !== eventSource) return
    resetWatchdogTimer(source)
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

  const onHeartbeat = (source: EventStream) => {
    if (disconnected || source !== eventSource) return
    resetWatchdogTimer(source)
  }

  const onOpen = (source: EventStream) => {
    if (disconnected || source !== eventSource) return
    resetWatchdogTimer(source)
    if (hasConnected || shouldInvalidateOnOpen) queueInvalidation(null)
    hasConnected = true
    shouldInvalidateOnOpen = false
    reconnectAttempt = 0
    sessionCheckRequested = false
  }

  const detachEventSource = (source: EventStream) => {
    if (eventSourceListeners != null) {
      source.removeEventListener('change', eventSourceListeners.change)
      source.removeEventListener('heartbeat', eventSourceListeners.heartbeat)
      eventSourceListeners = undefined
    }
    source.onopen = null
    source.onerror = null
    source.close()
    clearWatchdogTimer()
  }

  const attachEventSource = () => {
    const source = createEventSource('/api/events')
    eventSource = source
    const listeners = {
      change: (event: Event) => {
        onChange(source, event)
      },
      heartbeat: () => {
        onHeartbeat(source)
      },
    }
    eventSourceListeners = listeners
    source.addEventListener('change', listeners.change)
    source.addEventListener('heartbeat', listeners.heartbeat)
    source.onopen = () => {
      onOpen(source)
    }
    source.onerror = () => {
      onError(source)
    }
    resetWatchdogTimer(source)
  }

  const onError = (source: EventStream) => {
    if (disconnected || source !== eventSource) return
    if (!sessionCheckRequested) {
      sessionCheckRequested = true
      void requestSessionCheck().catch(() => undefined)
    }
    if (source.readyState === EVENT_SOURCE_CLOSED) clearWatchdogTimer()
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
    unsubscribeFromPendingFetches?.()
    unsubscribeFromPendingFetches = undefined
    if (reconnectTimer != null) clearTimeout(reconnectTimer)
    detachEventSource(eventSource)
  }
}
