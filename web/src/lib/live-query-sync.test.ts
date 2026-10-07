import {
  QueryClient,
  type QueryFunctionContext,
  QueryObserver,
} from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { connectLiveQuerySync } from '#lib/live-query-sync'
import { githubSyncKeys } from '#lib/query-keys'

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

class TestEventStream extends EventTarget implements EventStream {
  onopen: ((event: Event) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  readyState = 0
  closed = false
  opened = false

  close(): void {
    this.closed = true
    this.readyState = 2
  }

  open(): void {
    this.readyState = 1
    this.opened = true
    this.onopen?.(new Event('open'))
  }

  fail(): void {
    this.onerror?.(new Event('error'))
  }

  failPermanently(): void {
    this.readyState = 2
    this.fail()
  }

  sendChange(data: string): void {
    this.dispatchEvent(Object.assign(new Event('change'), { data }))
  }
}

const clients: QueryClient[] = []
const disconnectors: Array<() => void> = []

function createConnection(
  options: {
    origin?: string
    checkSession?: () => Promise<unknown>
    queryClient?: QueryClient
  } = {},
) {
  const queryClient = options.queryClient ?? new QueryClient()
  const eventStream = new TestEventStream()
  const eventStreams = [eventStream]
  const invalidateQueries = queryClient.invalidateQueries.bind(queryClient)
  const invalidations = vi
    .spyOn(queryClient, 'invalidateQueries')
    .mockImplementation((filters, invalidationOptions) =>
      invalidateQueries(filters, invalidationOptions),
    )
  const urls: string[] = []
  const disconnect = connectLiveQuerySync(queryClient, {
    origin: options.origin ?? 'screen-one',
    createEventSource: (url) => {
      urls.push(url)
      if (urls.length === 1) return eventStream
      const replacement = new TestEventStream()
      eventStreams.push(replacement)
      return replacement
    },
    ...(options.checkSession === undefined
      ? {}
      : { checkSession: options.checkSession }),
  })
  clients.push(queryClient)
  disconnectors.push(disconnect)
  return {
    disconnect,
    eventStream,
    eventStreams,
    invalidations,
    queryClient,
    urls,
  }
}

function observeQuery(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  fetchQuery: (context: QueryFunctionContext) => Promise<string> = () =>
    Promise.resolve('fresh'),
) {
  const queryFn = vi.fn(fetchQuery)
  const observer = new QueryObserver(queryClient, {
    queryKey,
    queryFn,
    initialData: 'cached',
    staleTime: Infinity,
  })
  const unsubscribe = observer.subscribe(() => undefined)
  return { observer, queryFn, unsubscribe }
}

afterEach(() => {
  for (const disconnect of disconnectors) disconnect()
  for (const queryClient of clients) queryClient.clear()
  disconnectors.length = 0
  clients.length = 0
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('connectLiveQuerySync', () => {
  it('connects to the event stream and ignores changes from this screen', async () => {
    vi.useFakeTimers()
    const { eventStream, invalidations, urls } = createConnection()

    eventStream.sendChange(
      JSON.stringify({
        resource: 'task',
        id: 'task-one',
        origin: 'screen-one',
      }),
    )
    eventStream.sendChange(
      JSON.stringify({
        resource: 'task',
        id: 'task-one',
        origin: 'screen-two',
      }),
    )
    await vi.advanceTimersByTimeAsync(1_000)

    const snapshot = () => ({
      urls,
      invalidations: invalidations.mock.calls.map(([filters]) => filters),
    })
    expect(snapshot()).toEqual({
      urls: ['/api/events'],
      invalidations: [
        { queryKey: ['tasks'] },
        { queryKey: ['projects'] },
        { queryKey: ['queues'] },
      ],
    })
  })

  it('coalesces changes received within one second', async () => {
    vi.useFakeTimers()
    const queryClient = new QueryClient()
    const taskQuery = observeQuery(queryClient, ['tasks'])
    const timeBlockQuery = observeQuery(queryClient, ['time-blocks'])
    const { eventStream, invalidations } = createConnection({ queryClient })

    for (let index = 0; index < 36; index += 1) {
      eventStream.sendChange(
        JSON.stringify({
          resource: index % 2 === 0 ? 'task' : 'time_block',
          id: `task-${String(index)}`,
          origin: 'screen-two',
        }),
      )
      if (index < 35) await vi.advanceTimersByTimeAsync(25)
    }
    await vi.advanceTimersByTimeAsync(124)
    const invalidationsBeforeWindowEnd = invalidations.mock.calls.map(
      ([filters]) => filters?.queryKey,
    )
    await vi.advanceTimersByTimeAsync(1)
    taskQuery.unsubscribe()
    timeBlockQuery.unsubscribe()

    const snapshot = () => ({
      invalidationsBeforeWindowEnd,
      invalidationKeysAtWindowEnd: invalidations.mock.calls.map(
        ([filters]) => filters?.queryKey,
      ),
      taskFetchCount: taskQuery.queryFn.mock.calls.length,
      timeBlockFetchCount: timeBlockQuery.queryFn.mock.calls.length,
    })
    expect(snapshot()).toEqual({
      invalidationsBeforeWindowEnd: [],
      invalidationKeysAtWindowEnd: [
        ['tasks'],
        ['projects'],
        ['queues'],
        ['time-blocks'],
      ],
      taskFetchCount: 1,
      timeBlockFetchCount: 1,
    })
  })

  it('refreshes after an in-flight query settles without aborting it', async () => {
    vi.useFakeTimers()
    const queryClient = new QueryClient()
    const requestSignals: AbortSignal[] = []
    let finishRequest: (value: string) => void = () => {}
    const { observer, queryFn, unsubscribe } = observeQuery(
      queryClient,
      ['tasks'],
      ({ signal }) => {
        requestSignals.push(signal)
        if (requestSignals.length > 1) return Promise.resolve('fresh')
        return new Promise<string>((resolve) => {
          finishRequest = resolve
        })
      },
    )
    const pendingFetch = observer.refetch()
    const { eventStream } = createConnection({ queryClient })

    eventStream.sendChange(
      JSON.stringify({ resource: 'task', id: 'task-one', origin: null }),
    )
    await vi.advanceTimersByTimeAsync(1_000)
    const requestStateWhileFetching = {
      requestCount: queryFn.mock.calls.length,
      aborted: requestSignals.map(({ aborted }) => aborted),
    }
    finishRequest('fresh')
    await pendingFetch
    await vi.advanceTimersByTimeAsync(0)
    unsubscribe()

    const snapshot = () => ({
      requestStateWhileFetching,
      requestStateAfterFirstFetch: {
        requestCount: queryFn.mock.calls.length,
        aborted: requestSignals.map(({ aborted }) => aborted),
      },
    })
    expect(snapshot()).toEqual({
      requestStateWhileFetching: { requestCount: 1, aborted: [false] },
      requestStateAfterFirstFetch: {
        requestCount: 2,
        aborted: [false, false],
      },
    })
  })

  it('skips GitHub sync queries during unknown-event and reconnect refreshes', async () => {
    vi.useFakeTimers()
    const queryClient = new QueryClient()
    const queries = [
      observeQuery(queryClient, ['tasks']),
      observeQuery(queryClient, githubSyncKeys.all),
      observeQuery(queryClient, githubSyncKeys.task('task-one')),
    ]
    const { eventStream } = createConnection({ queryClient })

    eventStream.sendChange(
      JSON.stringify({ resource: 'unknown_resource', id: null, origin: null }),
    )
    await vi.advanceTimersByTimeAsync(1_000)
    const queryCountsAfterUnknownEvent = queries.map(
      ({ queryFn }) => queryFn.mock.calls.length,
    )

    eventStream.open()
    eventStream.open()
    await vi.advanceTimersByTimeAsync(1_000)
    const queryCountsAfterReconnect = queries.map(
      ({ queryFn }) => queryFn.mock.calls.length,
    )
    for (const query of queries) query.unsubscribe()

    const snapshot = () => ({
      queryCountsAfterUnknownEvent,
      queryCountsAfterReconnect,
    })
    expect(snapshot()).toEqual({
      queryCountsAfterUnknownEvent: [1, 0, 0],
      queryCountsAfterReconnect: [2, 0, 0],
    })
  })

  it('ignores known resources without query consumers', () => {
    const { eventStream, invalidations } = createConnection()

    eventStream.sendChange(
      JSON.stringify({ resource: 'github', id: null, origin: null }),
    )

    expect(invalidations.mock.calls).toEqual([])
  })

  it('waits for a local mutation before applying queued invalidations', async () => {
    vi.useFakeTimers()
    const { eventStream, invalidations, queryClient } = createConnection()
    let finishMutation = () => {}
    let signalMutationStarted = () => {}
    const mutationStarted = new Promise<void>((resolve) => {
      signalMutationStarted = resolve
    })
    const mutation = queryClient.getMutationCache().build(queryClient, {
      mutationFn: () =>
        new Promise<string>((resolve) => {
          finishMutation = () => {
            resolve('saved')
          }
          signalMutationStarted()
        }),
    })
    const pendingMutation = mutation.execute(undefined)
    await mutationStarted

    eventStream.sendChange(
      JSON.stringify({ resource: 'time_block', id: 'block-one', origin: null }),
    )
    await vi.advanceTimersByTimeAsync(1_000)
    const invalidationsWhilePending = invalidations.mock.calls.map(
      ([filters]) => filters,
    )
    finishMutation()
    await pendingMutation

    const snapshot = () => ({
      invalidationsWhilePending,
      invalidationsAfterMutation: invalidations.mock.calls.map(
        ([filters]) => filters,
      ),
    })
    expect(snapshot()).toEqual({
      invalidationsWhilePending: [],
      invalidationsAfterMutation: [
        { queryKey: ['time-blocks'] },
        { queryKey: ['tasks'] },
      ],
    })
  })

  it('checks the session once per disconnected interval', () => {
    const checkSession = vi.fn(() => Promise.resolve())
    const { eventStream } = createConnection({ checkSession })

    eventStream.fail()
    eventStream.fail()
    eventStream.open()
    eventStream.fail()

    expect(checkSession.mock.calls).toEqual([[], []])
  })

  it('recreates a permanently closed stream and invalidates after recovery', async () => {
    vi.useFakeTimers()
    const checkSession = vi.fn(() => Promise.resolve())
    const { eventStream, eventStreams, invalidations, urls } = createConnection(
      {
        checkSession,
      },
    )

    eventStream.failPermanently()
    await vi.advanceTimersByTimeAsync(1_000)
    eventStreams[1]?.open()
    await vi.advanceTimersByTimeAsync(1_000)

    const snapshot = () => ({
      urls,
      streamStates: eventStreams.map(({ closed, opened }) => ({
        closed,
        opened,
      })),
      sessionChecks: checkSession.mock.calls,
      invalidations: invalidations.mock.calls.map(([filters, options]) => ({
        hasPredicate: typeof filters?.predicate === 'function',
        cancelRefetch: options?.cancelRefetch,
      })),
    })
    expect(snapshot()).toEqual({
      urls: ['/api/events', '/api/events'],
      streamStates: [
        { closed: true, opened: false },
        { closed: false, opened: true },
      ],
      sessionChecks: [[]],
      invalidations: [{ hasPredicate: true, cancelRefetch: false }],
    })
  })

  it('closes the event stream when disconnected', () => {
    const { disconnect, eventStream } = createConnection()

    disconnect()

    expect(eventStream.closed).toBe(true)
  })
})
