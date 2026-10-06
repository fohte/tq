import { QueryClient } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { connectLiveQuerySync } from '#lib/live-query-sync'

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
  } = {},
) {
  const queryClient = new QueryClient()
  const eventStream = new TestEventStream()
  const eventStreams = [eventStream]
  const invalidations = vi
    .spyOn(queryClient, 'invalidateQueries')
    .mockResolvedValue(undefined)
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

afterEach(() => {
  for (const disconnect of disconnectors) disconnect()
  for (const queryClient of clients) queryClient.clear()
  disconnectors.length = 0
  clients.length = 0
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('connectLiveQuerySync', () => {
  it('connects to the event stream and ignores changes from this screen', () => {
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

  it('invalidates all queries for an unrecognized resource', () => {
    const { eventStream, invalidations } = createConnection()

    eventStream.sendChange(
      JSON.stringify({ resource: 'unknown_resource', id: null, origin: null }),
    )

    expect(invalidations.mock.calls.map(([filters]) => filters)).toEqual([
      undefined,
    ])
  })

  it('ignores known resources without query consumers', () => {
    const { eventStream, invalidations } = createConnection()

    eventStream.sendChange(
      JSON.stringify({ resource: 'github', id: null, origin: null }),
    )

    expect(invalidations.mock.calls).toEqual([])
  })

  it('waits for a local mutation before applying queued invalidations', async () => {
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

  it('invalidates everything after reconnecting', () => {
    const { eventStream, invalidations } = createConnection()

    eventStream.open()
    eventStream.open()

    expect(invalidations.mock.calls.map(([filters]) => filters)).toEqual([
      undefined,
    ])
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

    const snapshot = () => ({
      urls,
      streamStates: eventStreams.map(({ closed, opened }) => ({
        closed,
        opened,
      })),
      sessionChecks: checkSession.mock.calls,
      invalidations: invalidations.mock.calls.map(([filters]) => filters),
    })
    expect(snapshot()).toEqual({
      urls: ['/api/events', '/api/events'],
      streamStates: [
        { closed: true, opened: false },
        { closed: false, opened: true },
      ],
      sessionChecks: [[]],
      invalidations: [undefined],
    })
  })

  it('closes the event stream when disconnected', () => {
    const { disconnect, eventStream } = createConnection()

    disconnect()

    expect(eventStream.closed).toBe(true)
  })
})
