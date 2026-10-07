import type { Query, QueryClient, QueryFilters } from '@tanstack/react-query'
import {
  type ChangeEvent,
  type ChangeResource,
  isChangeResource,
} from 'api/lib/change-event-contract'
import { Result } from 'neverthrow'

import {
  descriptionTemplateKeys,
  githubSyncKeys,
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

interface LiveQuerySyncOptions {
  origin?: string
  createEventSource?: EventSourceFactory
  checkSession?: () => Promise<unknown>
}

interface ResourceInvalidation {
  filters: QueryFilters[]
  taskIds?: string[]
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
  ...filters: QueryFilters[]
): ResourceInvalidation {
  return { ...invalidation, filters: [...invalidation.filters, ...filters] }
}

function withLeadingFilters(
  invalidation: ResourceInvalidation,
  ...filters: QueryFilters[]
): ResourceInvalidation {
  return { ...invalidation, filters: [...filters, ...invalidation.filters] }
}

function taskIdFromPreview(data: unknown): string | null {
  if (!isRecord(data)) return null
  if (typeof data['id'] === 'string') return data['id']
  const task = data['task']
  return isRecord(task) && typeof task['id'] === 'string' ? task['id'] : null
}

function isTaskQueryForIds(
  query: Query,
  taskIds: ReadonlySet<string>,
): boolean {
  const [namespace, section, id] = query.queryKey
  if (namespace !== taskKeys.all[0]) return false

  if (section === 'detail') {
    return typeof id === 'string' && taskIds.has(id)
  }

  if ((id === 'comments' || id === 'activity') && typeof section === 'string') {
    return taskIds.has(section)
  }

  if (
    section === 'mention-preview' ||
    section === 'task-url-preview' ||
    section === 'github-url-preview'
  ) {
    if (
      (typeof id === 'string' || typeof id === 'number') &&
      taskIds.has(String(id))
    ) {
      return true
    }
    const taskId = taskIdFromPreview(query.state.data)
    return taskId != null && taskIds.has(taskId)
  }

  return false
}

const resourceQueryFilters: Record<
  ChangeResource,
  (event: ChangeEvent) => ResourceInvalidation | null
> = {
  task: ({ taskIds }) =>
    withFilters(
      taskInvalidation(taskIds, true, { queryKey: taskKeys.all }),
      { queryKey: projectKeys.all },
      { queryKey: queueKeys.all },
    ),
  project: () => ({ filters: [{ queryKey: projectKeys.all }] }),
  label: ({ taskIds }) =>
    withLeadingFilters(
      taskInvalidation(taskIds, true, { queryKey: taskKeys.all }),
      { queryKey: labelKeys.all },
    ),
  queue: () => ({ filters: [{ queryKey: queueKeys.all }] }),
  time_block: ({ taskIds }) =>
    withLeadingFilters(
      taskInvalidation(taskIds, false, { queryKey: taskKeys.details }),
      { queryKey: timeBlockKeys.all },
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
    withLeadingFilters(
      taskInvalidation(taskIds, false, { queryKey: taskKeys.details }),
      { queryKey: ['agent-sessions'] },
    ),
  checklist: ({ taskIds }) =>
    taskInvalidation(taskIds, true, { queryKey: taskKeys.all }),
  checklist_item: ({ taskIds }) =>
    taskInvalidation(taskIds, true, { queryKey: taskKeys.all }),
  scheduling_setting: () => ({
    filters: [{ queryKey: ['scheduling-settings'] }],
  }),
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
      { queryKey: githubSyncKeys.all },
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
  let pendingAll = false
  let hasConnected = false
  let sessionCheckRequested = false
  let shouldInvalidateOnOpen = false
  let reconnectAttempt = 0
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined
  let invalidationTimer: ReturnType<typeof setTimeout> | undefined
  let waitingForMutation = false
  const pendingFetchQueryHashes = new Set<string>()
  let unsubscribeFromPendingFetches: (() => void) | undefined
  let disconnected = false
  let eventSource: EventStream

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
      invalidateFilters([
        {
          predicate: (query) => query.queryKey[0] !== githubSyncKeys.all[0],
        },
      ])
      return
    }

    const filters = [...pendingFilters.values()]
    pendingFilters.clear()
    if (pendingTaskIds.size > 0) {
      const taskIds = new Set(pendingTaskIds)
      filters.push({ predicate: (query) => isTaskQueryForIds(query, taskIds) })
      pendingTaskIds.clear()
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
    } else if (!pendingAll) {
      for (const filter of invalidation.filters) {
        pendingFilters.set(JSON.stringify(filter), filter)
      }
      for (const taskId of invalidation.taskIds ?? []) {
        pendingTaskIds.add(taskId)
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
    unsubscribeFromPendingFetches?.()
    unsubscribeFromPendingFetches = undefined
    if (reconnectTimer != null) clearTimeout(reconnectTimer)
    detachEventSource(eventSource)
  }
}
