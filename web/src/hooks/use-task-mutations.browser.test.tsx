import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { Mock } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  makeTask,
  makeTaskDetail,
} from '#components/task/task-row-test-fixtures'
import { useUpdateTask } from '#hooks/use-task-mutations'
import type { Task, TaskDetail } from '#hooks/use-task-queries'
import { allTasksFilter, taskKeys } from '#hooks/use-task-queries'
import { assertDefined } from '#lib/test-utils'

vi.mock('#lib/api', () => {
  const mockTaskPatch = vi.fn()
  return {
    api: {
      api: {
        tasks: {
          $get: vi.fn(),
          ':id': { $patch: mockTaskPatch },
        },
      },
    },
    __mocks: { mockTaskPatch },
  }
})

async function getMockTaskPatch() {
  const mod = await import('#lib/api')
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- accessing the test-only mock injected by vi.mock
  const typed = mod as unknown as { __mocks: { mockTaskPatch: Mock } }
  return typed.__mocks.mockTaskPatch
}

let queryClient: QueryClient

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

beforeEach(async () => {
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  const mockTaskPatch = await getMockTaskPatch()
  mockTaskPatch.mockReset()
})

afterEach(() => {
  queryClient.clear()
})

const taskId = '00000000-0000-0000-0000-000000000001'

function normalizeUpdatedAt<T extends { updatedAt: string }>(task: T): T {
  return { ...task, updatedAt: '<updated-at>' }
}

function readFieldValueState() {
  const tasks = queryClient.getQueryData<Task[]>(taskKeys.list(allTasksFilter))
  const detail = queryClient.getQueryData<TaskDetail>(taskKeys.detail(taskId))

  return {
    list: tasks?.map(normalizeUpdatedAt),
    detail: detail ? normalizeUpdatedAt(detail) : null,
  }
}

function readPriorityState() {
  const detail = queryClient.getQueryData<TaskDetail>(taskKeys.detail(taskId))

  return {
    list: queryClient
      .getQueryData<Task[]>(taskKeys.list(allTasksFilter))
      ?.map(({ priority }) => ({ priority })),
    detail: detail == null ? null : { priority: detail.priority },
  }
}

async function optimisticallyUpdateTask(
  input: { priority: number | null } | { title: string },
) {
  const task = makeTask({ id: taskId, priority: 0 })
  queryClient.setQueryData(taskKeys.list(allTasksFilter), [task])
  queryClient.setQueryData(
    taskKeys.detail(taskId),
    makeTaskDetail({ id: taskId, priority: 0 }),
  )

  let resolvePatch: ((response: Response) => void) | undefined
  const pendingPatch = new Promise<Response>((resolve) => {
    resolvePatch = resolve
  })
  let signalPatchCalled: (() => void) | undefined
  const patchCalled = new Promise<void>((resolve) => {
    signalPatchCalled = resolve
  })
  const mockTaskPatch = await getMockTaskPatch()
  mockTaskPatch.mockImplementation(() => {
    assertDefined(signalPatchCalled)()
    return pendingPatch
  })

  const { result } = renderHook(() => useUpdateTask(), { wrapper })
  let signalSettled: (() => void) | undefined
  const settled = new Promise<void>((resolve) => {
    signalSettled = resolve
  })
  act(() => {
    result.current.mutate(
      { id: taskId, input },
      {
        onSettled: () => {
          assertDefined(signalSettled)()
        },
      },
    )
  })
  await patchCalled

  const state = readPriorityState()
  assertDefined(resolvePatch)(
    new Response(JSON.stringify(task), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
  await settled

  return state
}

describe('useUpdateTask priority optimism', () => {
  it.each([
    { name: 'unset', priority: null },
    { name: 'negative', priority: -1 },
    { name: 'zero', priority: 0 },
    { name: 'positive one', priority: 1 },
    { name: 'positive two', priority: 2 },
  ] as const)('$name priority updates optimistically', async ({ priority }) => {
    const state = await optimisticallyUpdateTask({ priority })

    expect(state).toEqual({
      list: [{ priority }],
      detail: { priority },
    })
  })

  it('keeps priority when another field changes', async () => {
    const state = await optimisticallyUpdateTask({ title: 'Updated task' })

    expect(state).toEqual({
      list: [{ priority: 0 }],
      detail: { priority: 0 },
    })
  })
})

describe('useUpdateTask custom field values', () => {
  it('keeps response-shaped field values until the server refetches', async () => {
    const fieldValue = {
      fieldId: 'field-stage',
      fieldName: 'DeliveryStage',
      optionId: 'option-triage',
      optionName: 'Triage',
    }
    const task = makeTask({ id: taskId, fieldValues: [fieldValue] })
    const detail = makeTaskDetail({ id: taskId, fieldValues: [fieldValue] })
    queryClient.setQueryData(taskKeys.list(allTasksFilter), [task])
    queryClient.setQueryData(taskKeys.detail(taskId), detail)

    let resolvePatch: ((response: Response) => void) | undefined
    const pendingPatch = new Promise<Response>((resolve) => {
      resolvePatch = resolve
    })
    const mockTaskPatch = await getMockTaskPatch()
    mockTaskPatch.mockReturnValue(pendingPatch)

    const { result } = renderHook(() => useUpdateTask(), { wrapper })
    let signalSettled: (() => void) | undefined
    const settled = new Promise<void>((resolve) => {
      signalSettled = resolve
    })
    act(() => {
      result.current.mutate(
        {
          id: taskId,
          input: { fieldValues: { [fieldValue.fieldId]: 'option-review' } },
        },
        {
          onSettled: () => {
            assertDefined(signalSettled)()
          },
        },
      )
    })
    await vi.waitFor(() => {
      expect(mockTaskPatch).toHaveBeenCalled()
    })

    const readResult = () => ({
      patchCalls: mockTaskPatch.mock.calls,
      cache: readFieldValueState(),
    })
    expect(readResult()).toEqual({
      patchCalls: [
        [
          {
            param: { id: taskId },
            json: { fieldValues: { [fieldValue.fieldId]: 'option-review' } },
          },
        ],
      ],
      cache: {
        list: [normalizeUpdatedAt(task)],
        detail: normalizeUpdatedAt(detail),
      },
    })

    assertDefined(resolvePatch)(
      new Response(JSON.stringify(task), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    await settled
  })
})
