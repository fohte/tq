import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { projectKeys } from '#hooks/use-projects'
import { taskKeys } from '#hooks/use-task-queries'
import {
  useCreateTaskWait,
  useDeleteTaskWait,
  useResolveTaskWait,
  useUpdateTaskWait,
} from '#hooks/use-task-waits'

const { postWait, patchWait, resolveWait, deleteWait } = vi.hoisted(() => ({
  postWait: vi.fn(),
  patchWait: vi.fn(),
  resolveWait: vi.fn(),
  deleteWait: vi.fn(),
}))

vi.mock('#lib/api', () => ({
  api: {
    api: {
      tasks: {
        ':taskId': {
          waits: {
            $post: postWait,
            ':waitId': {
              $patch: patchWait,
              resolve: { $post: resolveWait },
              $delete: deleteWait,
            },
          },
        },
      },
    },
  },
}))

const taskId = '10000000-0000-4000-8000-000000000401'
const waitId = '30000000-0000-4000-8000-000000000401'

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

function successResponse() {
  return new Response(JSON.stringify({ id: waitId }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  postWait.mockReset().mockResolvedValue(successResponse())
  patchWait.mockReset().mockResolvedValue(successResponse())
  resolveWait.mockReset().mockResolvedValue(successResponse())
  deleteWait.mockReset().mockResolvedValue(successResponse())
})

describe('task wait mutations', () => {
  function renderMutations() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    const invalidateQueries = vi
      .spyOn(queryClient, 'invalidateQueries')
      .mockResolvedValue(undefined)
    const { result } = renderHook(
      () => ({
        create: useCreateTaskWait(),
        update: useUpdateTaskWait(taskId),
        resolve: useResolveTaskWait(taskId),
        delete: useDeleteTaskWait(taskId),
      }),
      { wrapper: createWrapper(queryClient) },
    )
    return { result, invalidateQueries }
  }

  it('creates a wait and invalidates task and project data', async () => {
    const { result, invalidateQueries } = renderMutations()
    await act(async () =>
      result.current.create.mutateAsync({
        taskId,
        body: 'Review the proposal',
        followUpDate: '2099-10-13',
      }),
    )

    const readActual = () => ({
      calls: postWait.mock.calls,
      invalidationKeys: invalidateQueries.mock.calls.map(
        ([filters]) => filters?.queryKey,
      ),
    })
    expect(readActual()).toEqual({
      calls: [
        [
          {
            param: { taskId },
            json: { body: 'Review the proposal', followUpDate: '2099-10-13' },
          },
        ],
      ],
      invalidationKeys: [
        taskKeys.detail(taskId),
        taskKeys.all,
        projectKeys.all,
      ],
    })
  })

  it('updates a wait and invalidates task and project data', async () => {
    const { result, invalidateQueries } = renderMutations()
    await act(async () =>
      result.current.update.mutateAsync({
        waitId,
        body: 'Review the revised proposal',
      }),
    )

    const readActual = () => ({
      calls: patchWait.mock.calls,
      invalidationKeys: invalidateQueries.mock.calls.map(
        ([filters]) => filters?.queryKey,
      ),
    })
    expect(readActual()).toEqual({
      calls: [
        [
          {
            param: { taskId, waitId },
            json: { body: 'Review the revised proposal' },
          },
        ],
      ],
      invalidationKeys: [
        taskKeys.detail(taskId),
        taskKeys.all,
        projectKeys.all,
      ],
    })
  })

  it('resolves a wait and invalidates task and project data', async () => {
    const { result, invalidateQueries } = renderMutations()
    await act(async () => result.current.resolve.mutateAsync(waitId))

    const readActual = () => ({
      calls: resolveWait.mock.calls,
      invalidationKeys: invalidateQueries.mock.calls.map(
        ([filters]) => filters?.queryKey,
      ),
    })
    expect(readActual()).toEqual({
      calls: [[{ param: { taskId, waitId } }]],
      invalidationKeys: [
        taskKeys.detail(taskId),
        taskKeys.all,
        projectKeys.all,
      ],
    })
  })

  it('deletes a wait and invalidates task and project data', async () => {
    const { result, invalidateQueries } = renderMutations()
    await act(async () => result.current.delete.mutateAsync(waitId))

    const readActual = () => ({
      calls: deleteWait.mock.calls,
      invalidationKeys: invalidateQueries.mock.calls.map(
        ([filters]) => filters?.queryKey,
      ),
    })
    expect(readActual()).toEqual({
      calls: [[{ param: { taskId, waitId } }]],
      invalidationKeys: [
        taskKeys.detail(taskId),
        taskKeys.all,
        projectKeys.all,
      ],
    })
  })
})
