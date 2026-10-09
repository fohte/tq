import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import {
  makeTask,
  makeTaskDetail,
} from '#components/task/task-row-test-fixtures'
import { projectKeys } from '#hooks/use-projects'
import { type TaskDetail, taskKeys } from '#hooks/use-task-queries'
import {
  useUpdateTaskBlockedBy,
  useUpdateTaskParent,
} from '#hooks/use-task-relation-mutations'
import { assertDefined } from '#lib/test-utils'

const { patchTask, patchParent } = vi.hoisted(() => ({
  patchTask: vi.fn(),
  patchParent: vi.fn(),
}))

vi.mock('#lib/api', () => ({
  api: {
    api: {
      tasks: {
        ':id': { $patch: patchTask, parent: { $patch: patchParent } },
      },
    },
  },
}))

function createWrapper(
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  }),
) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

function normalizeParentDetail(task: TaskDetail | undefined) {
  return task == null ? task : { ...task, updatedAt: '<updated-at>' }
}

function parentMutationSnapshot(
  queryClient: QueryClient,
  id: string,
  patchCallCount: number,
) {
  return {
    patchCallCount,
    detail: normalizeParentDetail(
      queryClient.getQueryData<TaskDetail>(taskKeys.detail(id)),
    ),
  }
}

describe('useUpdateTaskParent', () => {
  it('optimistically updates the parent number and title in task details', async () => {
    patchParent.mockClear()
    const id = 'task-child'
    const parent = makeTask({
      id: 'task-parent',
      number: 2,
      title: 'New parent',
    })
    const previousDetail = makeTaskDetail({
      id,
      parentId: 'task-old-parent',
      parentNumber: 1,
      parentTitle: 'Old parent',
    })
    const expectedDetail = makeTaskDetail({
      id,
      parentId: parent.id,
      parentNumber: parent.number,
      parentTitle: parent.title,
    })
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    queryClient.setQueryData(taskKeys.detail(id), previousDetail)
    let resolvePatch: (response: Response) => void = () => {}
    const pendingPatch = new Promise<Response>((resolve) => {
      resolvePatch = resolve
    })
    patchParent.mockReturnValueOnce(pendingPatch)
    const { result } = renderHook(() => useUpdateTaskParent(), {
      wrapper: createWrapper(queryClient),
    })

    let mutationPromise: Promise<unknown> = Promise.resolve()
    act(() => {
      mutationPromise = result.current.mutateAsync({
        id,
        parentId: parent.id,
        parent: { number: parent.number, title: parent.title },
      })
    })
    await waitFor(() => {
      if (patchParent.mock.calls.length === 0) {
        throw new Error('The parent update request has not started')
      }
    })

    expect(
      parentMutationSnapshot(queryClient, id, patchParent.mock.calls.length),
    ).toEqual({
      patchCallCount: 1,
      detail: normalizeParentDetail(expectedDetail),
    })

    resolvePatch(
      new Response('{}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    await act(async () => await mutationPromise)
  })

  it('optimistically clears the parent number and title in task details', async () => {
    patchParent.mockClear()
    const id = 'task-child'
    const previousDetail = makeTaskDetail({
      id,
      parentId: 'task-old-parent',
      parentNumber: 1,
      parentTitle: 'Old parent',
    })
    const expectedDetail = makeTaskDetail({
      id,
      parentId: null,
      parentNumber: null,
      parentTitle: null,
    })
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    queryClient.setQueryData(taskKeys.detail(id), previousDetail)
    let resolvePatch: (response: Response) => void = () => {}
    const pendingPatch = new Promise<Response>((resolve) => {
      resolvePatch = resolve
    })
    patchParent.mockReturnValueOnce(pendingPatch)
    const { result } = renderHook(() => useUpdateTaskParent(), {
      wrapper: createWrapper(queryClient),
    })

    let mutationPromise: Promise<unknown> = Promise.resolve()
    act(() => {
      mutationPromise = result.current.mutateAsync({
        id,
        parentId: null,
        parent: null,
      })
    })
    await waitFor(() => {
      if (patchParent.mock.calls.length === 0) {
        throw new Error('The parent update request has not started')
      }
    })

    expect(
      parentMutationSnapshot(queryClient, id, patchParent.mock.calls.length),
    ).toEqual({
      patchCallCount: 1,
      detail: normalizeParentDetail(expectedDetail),
    })

    resolvePatch(
      new Response('{}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    await act(async () => await mutationPromise)
  })
})

describe('useUpdateTaskBlockedBy', () => {
  it('sends existing GitHub blocker URLs with task blockers', async () => {
    patchTask.mockResolvedValueOnce(
      new Response('{}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const { result } = renderHook(() => useUpdateTaskBlockedBy(), {
      wrapper: createWrapper(),
    })

    await act(async () =>
      result.current.mutateAsync({
        id: 'blocked-task',
        blockedBy: [makeTask({ id: 'task-blocker' })],
        githubBlockerUrls: [
          'https://github.com/example-owner/example-repo/issues/17',
        ],
      }),
    )

    expect(patchTask.mock.calls).toEqual([
      [
        {
          param: { id: 'blocked-task' },
          json: {
            blockedBy: [
              'task-blocker',
              'https://github.com/example-owner/example-repo/issues/17',
            ],
          },
        },
      ],
    ])
  })

  it('invalidates task and project caches after changing blockers', async () => {
    patchTask.mockResolvedValueOnce(
      new Response('{}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useUpdateTaskBlockedBy(), {
      wrapper: createWrapper(queryClient),
    })

    await act(async () =>
      result.current.mutateAsync({
        id: 'blocked-task',
        blockedBy: [],
        githubBlockerUrls: [
          'https://github.com/example-owner/example-repo/issues/17',
        ],
      }),
    )

    expect(
      invalidateQueries.mock.calls.map(([filters]) => filters?.queryKey),
    ).toEqual([taskKeys.all, projectKeys.all])
  })

  it('keeps blocker updates pending until cache invalidation finishes', async () => {
    patchTask.mockResolvedValueOnce(
      new Response('{}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    let finishInvalidation: () => void = () => {}
    const pendingInvalidation = new Promise<void>((resolve) => {
      finishInvalidation = resolve
    })
    const invalidateQueries = vi
      .spyOn(queryClient, 'invalidateQueries')
      .mockImplementation(() => pendingInvalidation)
    const { result } = renderHook(() => useUpdateTaskBlockedBy(), {
      wrapper: createWrapper(queryClient),
    })
    let mutationPromise: Promise<unknown> | undefined

    act(() => {
      mutationPromise = result.current.mutateAsync({
        id: 'blocked-task',
        blockedBy: [],
        githubBlockerUrls: [
          'https://github.com/example-owner/example-repo/issues/17',
        ],
      })
    })

    const readActual = () => ({
      isPending: result.current.isPending,
      invalidationKeys: invalidateQueries.mock.calls.map(
        ([filters]) => filters?.queryKey,
      ),
    })

    await waitFor(() => {
      expect(readActual()).toEqual({
        isPending: true,
        invalidationKeys: [taskKeys.all, projectKeys.all],
      })
    })
    finishInvalidation()
    await act(async () => assertDefined(mutationPromise))
  })
})
