import {
  QueryClient,
  type QueryFunctionContext,
  QueryObserver,
} from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { connectLiveQuerySync } from '#lib/live-query-sync'
import {
  activityKeys,
  commentKeys,
  githubSyncKeys,
  githubUrlPreviewKeys,
  labelKeys,
  projectKeys,
  queueKeys,
  taskKeys,
  taskMentionKeys,
  taskUrlPreviewKeys,
  timeBlockKeys,
} from '#lib/query-keys'

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

  sendHeartbeat(): void {
    this.dispatchEvent(new Event('heartbeat'))
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

function observeTaskInvalidationQueries(queryClient: QueryClient) {
  const taskId = 'target-task-id'
  const otherTaskId = 'other-task-id'
  const queries = {
    taskList: observeQuery(queryClient, taskKeys.list()),
    taskInfiniteList: observeQuery(queryClient, taskKeys.infiniteList()),
    labelCounts: observeQuery(queryClient, taskKeys.labelCounts('work')),
    taskDetail: observeQuery(queryClient, taskKeys.detail(taskId)),
    otherTaskDetail: observeQuery(queryClient, taskKeys.detail(otherTaskId)),
    taskChecklist: observeQuery(queryClient, [
      ...taskKeys.detail(taskId),
      'checklists',
    ]),
    otherTaskChecklist: observeQuery(queryClient, [
      ...taskKeys.detail(otherTaskId),
      'checklists',
    ]),
    taskPage: observeQuery(queryClient, [
      ...taskKeys.detail(taskId),
      'pages',
      'page-id',
    ]),
    otherTaskPage: observeQuery(queryClient, [
      ...taskKeys.detail(otherTaskId),
      'pages',
      'page-id',
    ]),
    taskAgentSessions: observeQuery(queryClient, [
      ...taskKeys.detail(taskId),
      'agent-sessions',
    ]),
    otherTaskAgentSessions: observeQuery(queryClient, [
      ...taskKeys.detail(otherTaskId),
      'agent-sessions',
    ]),
    taskComments: observeQuery(queryClient, commentKeys.all(taskId)),
    otherTaskComments: observeQuery(queryClient, commentKeys.all(otherTaskId)),
    taskActivity: observeQuery(queryClient, activityKeys.all(taskId)),
    otherTaskActivity: observeQuery(queryClient, activityKeys.all(otherTaskId)),
    taskMentionPreview: observeQuery(queryClient, taskMentionKeys.preview(101)),
    unresolvedTaskMentionPreview: observeQuery(
      queryClient,
      taskMentionKeys.preview(103),
    ),
    otherTaskMentionPreview: observeQuery(
      queryClient,
      taskMentionKeys.preview(102),
    ),
    taskUrlPreviewById: observeQuery(
      queryClient,
      taskUrlPreviewKeys.preview(taskId),
    ),
    otherTaskUrlPreviewById: observeQuery(
      queryClient,
      taskUrlPreviewKeys.preview(otherTaskId),
    ),
    taskUrlPreviewByNumber: observeQuery(
      queryClient,
      taskUrlPreviewKeys.preview('101'),
    ),
    otherTaskUrlPreviewByNumber: observeQuery(
      queryClient,
      taskUrlPreviewKeys.preview('102'),
    ),
    taskGithubUrlPreview: observeQuery(
      queryClient,
      githubUrlPreviewKeys.preview('https://github.test/target'),
    ),
    otherTaskGithubUrlPreview: observeQuery(
      queryClient,
      githubUrlPreviewKeys.preview('https://github.test/other'),
    ),
    unlinkedGithubUrlPreview: observeQuery(
      queryClient,
      githubUrlPreviewKeys.preview('https://github.test/unlinked'),
    ),
    taskMentionSuggestions: observeQuery(
      queryClient,
      taskMentionKeys.suggestions('sample'),
    ),
    labels: observeQuery(queryClient, labelKeys.all),
    timeBlocks: observeQuery(queryClient, timeBlockKeys.list('start', 'end')),
    agentSessions: observeQuery(queryClient, ['agent-sessions', 'by-task']),
    projects: observeQuery(queryClient, projectKeys.all),
    queues: observeQuery(queryClient, queueKeys.all),
    githubSync: observeQuery(queryClient, githubSyncKeys.all),
  }

  queryClient.setQueryData(taskMentionKeys.preview(101), { id: taskId })
  queryClient.setQueryData(taskMentionKeys.preview(102), { id: otherTaskId })
  queryClient.setQueryData(taskMentionKeys.preview(103), null)
  queryClient.setQueryData(taskUrlPreviewKeys.preview('101'), { id: taskId })
  queryClient.setQueryData(taskUrlPreviewKeys.preview('102'), {
    id: otherTaskId,
  })
  queryClient.setQueryData(
    githubUrlPreviewKeys.preview('https://github.test/target'),
    { linked: true, task: { id: taskId } },
  )
  queryClient.setQueryData(
    githubUrlPreviewKeys.preview('https://github.test/other'),
    { linked: true, task: { id: otherTaskId } },
  )
  queryClient.setQueryData(
    githubUrlPreviewKeys.preview('https://github.test/unlinked'),
    { linked: false },
  )

  return queries
}

function taskInvalidationSnapshot(
  queries: ReturnType<typeof observeTaskInvalidationQueries>,
) {
  const fetchCount = (name: keyof typeof queries) =>
    queries[name].queryFn.mock.calls.length

  return {
    taskLists: [fetchCount('taskList'), fetchCount('taskInfiniteList')],
    labelCounts: fetchCount('labelCounts'),
    taskDetails: [
      fetchCount('taskDetail'),
      fetchCount('taskChecklist'),
      fetchCount('taskPage'),
      fetchCount('taskAgentSessions'),
      fetchCount('taskComments'),
      fetchCount('taskActivity'),
    ],
    otherTaskDetails: [
      fetchCount('otherTaskDetail'),
      fetchCount('otherTaskChecklist'),
      fetchCount('otherTaskPage'),
      fetchCount('otherTaskAgentSessions'),
      fetchCount('otherTaskComments'),
      fetchCount('otherTaskActivity'),
    ],
    taskPreviews: [
      fetchCount('taskMentionPreview'),
      fetchCount('taskUrlPreviewById'),
      fetchCount('taskUrlPreviewByNumber'),
      fetchCount('taskGithubUrlPreview'),
    ],
    otherTaskPreviews: [
      fetchCount('otherTaskMentionPreview'),
      fetchCount('otherTaskUrlPreviewById'),
      fetchCount('otherTaskUrlPreviewByNumber'),
      fetchCount('otherTaskGithubUrlPreview'),
    ],
    unresolvedPreviews: [
      fetchCount('unresolvedTaskMentionPreview'),
      fetchCount('unlinkedGithubUrlPreview'),
    ],
    otherQueries: [
      fetchCount('taskMentionSuggestions'),
      fetchCount('labels'),
      fetchCount('timeBlocks'),
      fetchCount('agentSessions'),
      fetchCount('projects'),
      fetchCount('queues'),
      fetchCount('githubSync'),
    ],
  }
}

function invalidationKeys(
  invalidations: ReturnType<typeof createConnection>['invalidations'],
) {
  return invalidations.mock.calls.map(([filters]) =>
    typeof filters?.predicate === 'function' ? 'predicate' : filters?.queryKey,
  )
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
        taskIds: ['task-one'],
      }),
    )
    await vi.advanceTimersByTimeAsync(1_000)

    const snapshot = () => ({
      urls,
      invalidations: invalidations.mock.calls.map(([filters]) =>
        typeof filters?.predicate === 'function' ? 'predicate' : filters,
      ),
    })
    expect(snapshot()).toEqual({
      urls: ['/api/events'],
      invalidations: [
        { queryKey: taskKeys.lists },
        { queryKey: taskKeys.infiniteLists },
        { queryKey: ['projects'] },
        { queryKey: ['queues'] },
        { queryKey: taskKeys.labelCountsPrefix },
        { queryKey: taskMentionKeys.suggestionsPrefix },
        'predicate',
      ],
    })
  })

  it('reconnects after 75 seconds without changes or heartbeats', async () => {
    vi.useFakeTimers()
    const queryClient = new QueryClient()
    const memoQuery = observeQuery(queryClient, ['memos', 'work'])
    const checkSession = vi.fn(() => Promise.resolve())
    const { eventStream, eventStreams, urls } = createConnection({
      queryClient,
      checkSession,
    })

    eventStream.open()
    await vi.advanceTimersByTimeAsync(45_000)
    eventStream.sendHeartbeat()
    await vi.advanceTimersByTimeAsync(45_000)
    eventStream.sendChange(
      JSON.stringify({
        resource: 'task',
        id: 'task-one',
        origin: 'screen-two',
      }),
    )
    await vi.advanceTimersByTimeAsync(74_999)
    const beforeTimeout = {
      streamCount: eventStreams.length,
      initialStreamClosed: eventStream.closed,
    }

    await vi.advanceTimersByTimeAsync(1)
    const afterTimeout = {
      streamCount: eventStreams.length,
      initialStreamClosed: eventStream.closed,
      urls: [...urls],
    }
    await vi.advanceTimersByTimeAsync(1_000)
    eventStreams[1]?.open()
    await vi.advanceTimersByTimeAsync(1_000)
    memoQuery.unsubscribe()

    const snapshot = () => ({
      beforeTimeout,
      afterTimeout,
      afterReconnect: {
        streamCount: eventStreams.length,
        initialStreamClosed: eventStream.closed,
        replacementStreamOpened: eventStreams[1]?.opened,
        urls,
        memoFetchCount: memoQuery.queryFn.mock.calls.length,
        sessionCheckCount: checkSession.mock.calls.length,
      },
    })
    expect(snapshot()).toEqual({
      beforeTimeout: { streamCount: 1, initialStreamClosed: false },
      afterTimeout: {
        streamCount: 1,
        initialStreamClosed: true,
        urls: ['/api/events'],
      },
      afterReconnect: {
        streamCount: 2,
        initialStreamClosed: true,
        replacementStreamOpened: true,
        urls: ['/api/events', '/api/events'],
        memoFetchCount: 1,
        sessionCheckCount: 1,
      },
    })
  })

  it('refreshes the memo changed by another screen', async () => {
    vi.useFakeTimers()
    const queryClient = new QueryClient()
    const queries = [
      observeQuery(queryClient, ['memos', 'work']),
      observeQuery(queryClient, ['memos', 'personal']),
    ]
    const { eventStream, invalidations } = createConnection({ queryClient })

    eventStream.sendChange(
      JSON.stringify({
        resource: 'memo',
        id: 'work',
        origin: 'screen-two',
      }),
    )
    await vi.advanceTimersByTimeAsync(1_000)
    for (const query of queries) query.unsubscribe()

    const snapshot = () => ({
      memoFetchCounts: queries.map((query) => query.queryFn.mock.calls.length),
      invalidationKeys: invalidationKeys(invalidations),
    })
    expect(snapshot()).toEqual({
      memoFetchCounts: [1, 0],
      invalidationKeys: [['memos', 'work']],
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
        ['tasks', 'detail'],
      ],
      taskFetchCount: 1,
      timeBlockFetchCount: 1,
    })
  })

  it.each([
    {
      resource: 'time_block',
      expectedInvalidationKeys: [['time-blocks'], ['tasks', 'detail']],
      expectedFetchCounts: [0, 0, 1, 1, 1, 0],
    },
    {
      resource: 'agent_session',
      expectedInvalidationKeys: [['agent-sessions'], ['tasks', 'detail']],
      expectedFetchCounts: [0, 0, 1, 1, 0, 1],
    },
  ])(
    'refreshes task details without refreshing task lists for $resource changes',
    async ({ resource, expectedInvalidationKeys, expectedFetchCounts }) => {
      vi.useFakeTimers()
      const queryClient = new QueryClient()
      const taskId = 'sample-task-id'
      const queries = [
        observeQuery(queryClient, taskKeys.list()),
        observeQuery(queryClient, taskKeys.infiniteList()),
        observeQuery(queryClient, taskKeys.detail(taskId)),
        observeQuery(queryClient, [
          ...taskKeys.detail(taskId),
          'agent-sessions',
        ]),
        observeQuery(
          queryClient,
          timeBlockKeys.list('sample-start', 'sample-end'),
        ),
        observeQuery(queryClient, ['agent-sessions', 'by-task', taskId]),
      ]
      const { eventStream, invalidations } = createConnection({ queryClient })

      eventStream.sendChange(
        JSON.stringify({ resource, id: null, origin: 'screen-two' }),
      )
      await vi.advanceTimersByTimeAsync(1_000)
      for (const query of queries) query.unsubscribe()

      const snapshot = () => ({
        invalidationKeys: invalidations.mock.calls.map(
          ([filters]) => filters?.queryKey,
        ),
        fetchCounts: queries.map(({ queryFn }) => queryFn.mock.calls.length),
      })
      expect(snapshot()).toEqual({
        invalidationKeys: expectedInvalidationKeys,
        fetchCounts: expectedFetchCounts,
      })
    },
  )

  it.each([
    {
      resource: 'task',
      expectedInvalidationKeys: [
        taskKeys.lists,
        taskKeys.infiniteLists,
        projectKeys.all,
        queueKeys.all,
        taskKeys.labelCountsPrefix,
        taskMentionKeys.suggestionsPrefix,
        'predicate',
      ],
      expectedTaskLists: [1, 1],
      expectedLabelCounts: 1,
      expectedOtherQueries: [1, 0, 0, 0, 1, 1, 0],
      expectedUnresolvedPreviews: [1, 1],
    },
    {
      resource: 'label',
      expectedInvalidationKeys: [
        labelKeys.all,
        taskKeys.lists,
        taskKeys.infiniteLists,
        taskKeys.labelCountsPrefix,
        'predicate',
      ],
      expectedTaskLists: [1, 1],
      expectedLabelCounts: 1,
      expectedOtherQueries: [0, 1, 0, 0, 0, 0, 0],
      expectedUnresolvedPreviews: [0, 0],
    },
    {
      resource: 'time_block',
      expectedInvalidationKeys: [timeBlockKeys.all, 'predicate'],
      expectedTaskLists: [0, 0],
      expectedLabelCounts: 0,
      expectedOtherQueries: [0, 0, 1, 0, 0, 0, 0],
      expectedUnresolvedPreviews: [0, 0],
    },
    {
      resource: 'agent_session',
      expectedInvalidationKeys: [['agent-sessions'], 'predicate'],
      expectedTaskLists: [0, 0],
      expectedLabelCounts: 0,
      expectedOtherQueries: [0, 0, 0, 1, 0, 0, 0],
      expectedUnresolvedPreviews: [0, 0],
    },
    {
      resource: 'checklist',
      expectedInvalidationKeys: [
        taskKeys.lists,
        taskKeys.infiniteLists,
        'predicate',
      ],
      expectedTaskLists: [1, 1],
      expectedLabelCounts: 0,
      expectedOtherQueries: [0, 0, 0, 0, 0, 0, 0],
      expectedUnresolvedPreviews: [0, 0],
    },
    {
      resource: 'checklist_item',
      expectedInvalidationKeys: [
        taskKeys.lists,
        taskKeys.infiniteLists,
        'predicate',
      ],
      expectedTaskLists: [1, 1],
      expectedLabelCounts: 0,
      expectedOtherQueries: [0, 0, 0, 0, 0, 0, 0],
      expectedUnresolvedPreviews: [0, 0],
    },
  ] as const)(
    'limits $resource changes with task IDs to affected queries',
    async ({
      resource,
      expectedInvalidationKeys,
      expectedTaskLists,
      expectedLabelCounts,
      expectedOtherQueries,
      expectedUnresolvedPreviews,
    }) => {
      vi.useFakeTimers()
      const queryClient = new QueryClient()
      const queries = observeTaskInvalidationQueries(queryClient)
      const { eventStream, invalidations } = createConnection({ queryClient })

      eventStream.sendChange(
        JSON.stringify({
          resource,
          id: null,
          origin: 'screen-two',
          taskIds: ['target-task-id'],
        }),
      )
      await vi.advanceTimersByTimeAsync(1_000)
      for (const query of Object.values(queries)) query.unsubscribe()

      const snapshot = () => ({
        invalidationKeys: invalidationKeys(invalidations),
        fetchCounts: taskInvalidationSnapshot(queries),
      })
      expect(snapshot()).toEqual({
        invalidationKeys: expectedInvalidationKeys,
        fetchCounts: {
          taskLists: expectedTaskLists,
          labelCounts: expectedLabelCounts,
          taskDetails: [1, 1, 1, 1, 1, 1],
          otherTaskDetails: [0, 0, 0, 0, 0, 0],
          taskPreviews: [1, 1, 1, 1],
          otherTaskPreviews: [0, 0, 0, 0],
          unresolvedPreviews: expectedUnresolvedPreviews,
          otherQueries: expectedOtherQueries,
        },
      })
    },
  )

  it.each([
    {
      resource: 'task',
      expectedInvalidationKeys: [taskKeys.all, projectKeys.all, queueKeys.all],
      expectedTaskLists: [1, 1],
      expectedLabelCounts: 1,
      expectedTaskDetails: [1, 1, 1, 1, 1, 1],
      expectedOtherTaskDetails: [1, 1, 1, 1, 1, 1],
      expectedTaskPreviews: [1, 1, 1, 1],
      expectedOtherTaskPreviews: [1, 1, 1, 1],
      expectedUnresolvedPreviews: [1, 1],
      expectedOtherQueries: [1, 0, 0, 0, 1, 1, 0],
    },
    {
      resource: 'label',
      expectedInvalidationKeys: [labelKeys.all, taskKeys.all],
      expectedTaskLists: [1, 1],
      expectedLabelCounts: 1,
      expectedTaskDetails: [1, 1, 1, 1, 1, 1],
      expectedOtherTaskDetails: [1, 1, 1, 1, 1, 1],
      expectedTaskPreviews: [1, 1, 1, 1],
      expectedOtherTaskPreviews: [1, 1, 1, 1],
      expectedUnresolvedPreviews: [1, 1],
      expectedOtherQueries: [1, 1, 0, 0, 0, 0, 0],
    },
    {
      resource: 'time_block',
      expectedInvalidationKeys: [timeBlockKeys.all, taskKeys.details],
      expectedTaskLists: [0, 0],
      expectedLabelCounts: 0,
      expectedTaskDetails: [1, 1, 1, 1, 0, 0],
      expectedOtherTaskDetails: [1, 1, 1, 1, 0, 0],
      expectedTaskPreviews: [0, 0, 0, 0],
      expectedOtherTaskPreviews: [0, 0, 0, 0],
      expectedUnresolvedPreviews: [0, 0],
      expectedOtherQueries: [0, 0, 1, 0, 0, 0, 0],
    },
    {
      resource: 'agent_session',
      expectedInvalidationKeys: [['agent-sessions'], taskKeys.details],
      expectedTaskLists: [0, 0],
      expectedLabelCounts: 0,
      expectedTaskDetails: [1, 1, 1, 1, 0, 0],
      expectedOtherTaskDetails: [1, 1, 1, 1, 0, 0],
      expectedTaskPreviews: [0, 0, 0, 0],
      expectedOtherTaskPreviews: [0, 0, 0, 0],
      expectedUnresolvedPreviews: [0, 0],
      expectedOtherQueries: [0, 0, 0, 1, 0, 0, 0],
    },
    {
      resource: 'checklist',
      expectedInvalidationKeys: [taskKeys.all],
      expectedTaskLists: [1, 1],
      expectedLabelCounts: 1,
      expectedTaskDetails: [1, 1, 1, 1, 1, 1],
      expectedOtherTaskDetails: [1, 1, 1, 1, 1, 1],
      expectedTaskPreviews: [1, 1, 1, 1],
      expectedOtherTaskPreviews: [1, 1, 1, 1],
      expectedUnresolvedPreviews: [1, 1],
      expectedOtherQueries: [1, 0, 0, 0, 0, 0, 0],
    },
    {
      resource: 'checklist_item',
      expectedInvalidationKeys: [taskKeys.all],
      expectedTaskLists: [1, 1],
      expectedLabelCounts: 1,
      expectedTaskDetails: [1, 1, 1, 1, 1, 1],
      expectedOtherTaskDetails: [1, 1, 1, 1, 1, 1],
      expectedTaskPreviews: [1, 1, 1, 1],
      expectedOtherTaskPreviews: [1, 1, 1, 1],
      expectedUnresolvedPreviews: [1, 1],
      expectedOtherQueries: [1, 0, 0, 0, 0, 0, 0],
    },
  ] as const)(
    'keeps the existing $resource invalidation range when task IDs are null',
    async ({
      resource,
      expectedInvalidationKeys,
      expectedTaskLists,
      expectedLabelCounts,
      expectedTaskDetails,
      expectedOtherTaskDetails,
      expectedTaskPreviews,
      expectedOtherTaskPreviews,
      expectedUnresolvedPreviews,
      expectedOtherQueries,
    }) => {
      vi.useFakeTimers()
      const queryClient = new QueryClient()
      const queries = observeTaskInvalidationQueries(queryClient)
      const { eventStream, invalidations } = createConnection({ queryClient })

      eventStream.sendChange(
        JSON.stringify({
          resource,
          id: null,
          origin: 'screen-two',
          taskIds: null,
        }),
      )
      await vi.advanceTimersByTimeAsync(1_000)
      for (const query of Object.values(queries)) query.unsubscribe()

      const snapshot = () => ({
        invalidationKeys: invalidationKeys(invalidations),
        fetchCounts: taskInvalidationSnapshot(queries),
      })
      expect(snapshot()).toEqual({
        invalidationKeys: expectedInvalidationKeys,
        fetchCounts: {
          taskLists: expectedTaskLists,
          labelCounts: expectedLabelCounts,
          taskDetails: expectedTaskDetails,
          otherTaskDetails: expectedOtherTaskDetails,
          taskPreviews: expectedTaskPreviews,
          otherTaskPreviews: expectedOtherTaskPreviews,
          unresolvedPreviews: expectedUnresolvedPreviews,
          otherQueries: expectedOtherQueries,
        },
      })
    },
  )

  it('merges task IDs from different events in one invalidation batch', async () => {
    vi.useFakeTimers()
    const queryClient = new QueryClient()
    const queries = {
      firstDetail: observeQuery(queryClient, taskKeys.detail('first-task-id')),
      secondDetail: observeQuery(
        queryClient,
        taskKeys.detail('second-task-id'),
      ),
      otherDetail: observeQuery(queryClient, taskKeys.detail('other-task-id')),
      firstComments: observeQuery(
        queryClient,
        commentKeys.all('first-task-id'),
      ),
      secondComments: observeQuery(
        queryClient,
        commentKeys.all('second-task-id'),
      ),
      otherComments: observeQuery(
        queryClient,
        commentKeys.all('other-task-id'),
      ),
    }
    const { eventStream, invalidations } = createConnection({ queryClient })

    eventStream.sendChange(
      JSON.stringify({
        resource: 'time_block',
        id: 'block-one',
        origin: 'screen-two',
        taskIds: ['first-task-id'],
      }),
    )
    eventStream.sendChange(
      JSON.stringify({
        resource: 'checklist',
        id: 'checklist-one',
        origin: 'screen-two',
        taskIds: ['second-task-id'],
      }),
    )
    await vi.advanceTimersByTimeAsync(1_000)
    for (const query of Object.values(queries)) query.unsubscribe()

    const snapshot = () => ({
      invalidationKeys: invalidationKeys(invalidations),
      fetchCounts: Object.fromEntries(
        Object.entries(queries).map(([name, query]) => [
          name,
          query.queryFn.mock.calls.length,
        ]),
      ),
    })
    expect(snapshot()).toEqual({
      invalidationKeys: [
        timeBlockKeys.all,
        taskKeys.lists,
        taskKeys.infiniteLists,
        'predicate',
      ],
      fetchCounts: {
        firstDetail: 1,
        secondDetail: 1,
        otherDetail: 0,
        firstComments: 1,
        secondComments: 1,
        otherComments: 0,
      },
    })
  })

  it('does not target task queries when task IDs are empty', async () => {
    vi.useFakeTimers()
    const queryClient = new QueryClient()
    const queries = observeTaskInvalidationQueries(queryClient)
    const { eventStream, invalidations } = createConnection({ queryClient })

    eventStream.sendChange(
      JSON.stringify({
        resource: 'checklist',
        id: null,
        origin: 'screen-two',
        taskIds: [],
      }),
    )
    await vi.advanceTimersByTimeAsync(1_000)
    for (const query of Object.values(queries)) query.unsubscribe()

    const snapshot = () => ({
      invalidationKeys: invalidationKeys(invalidations),
      fetchCounts: taskInvalidationSnapshot(queries),
    })
    expect(snapshot()).toEqual({
      invalidationKeys: [taskKeys.lists, taskKeys.infiniteLists],
      fetchCounts: {
        taskLists: [1, 1],
        labelCounts: 0,
        taskDetails: [0, 0, 0, 0, 0, 0],
        otherTaskDetails: [0, 0, 0, 0, 0, 0],
        taskPreviews: [0, 0, 0, 0],
        otherTaskPreviews: [0, 0, 0, 0],
        unresolvedPreviews: [0, 0],
        otherQueries: [0, 0, 0, 0, 0, 0, 0],
      },
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
        { queryKey: ['tasks', 'detail'] },
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
