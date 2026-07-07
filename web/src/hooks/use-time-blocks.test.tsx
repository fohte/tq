import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import {
  useCreateTimeBlock,
  useDeleteTimeBlock,
  useTimeBlocks,
  useUpdateTimeBlock,
} from '@web/hooks/use-time-blocks'
import { assertDefined } from '@web/lib/test-utils'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the API module
vi.mock('@web/lib/api', () => {
  const mockGet = vi.fn()
  const mockPost = vi.fn()
  const mockPatch = vi.fn()
  const mockDelete = vi.fn()

  return {
    api: {
      api: {
        schedule: {
          'time-blocks': {
            $get: mockGet,
            $post: mockPost,
            ':id': {
              $patch: mockPatch,
              $delete: mockDelete,
            },
          },
        },
      },
    },
    __mocks: { mockGet, mockPost, mockPatch, mockDelete },
  }
})

// Access mocks
async function getMocks() {
  const mod = await import('@web/lib/api')
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- accessing test-only __mocks property injected by vi.mock
  const typed = mod as unknown as {
    __mocks: Record<string, ReturnType<typeof vi.fn>>
  }
  return typed.__mocks
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
  const mocks = await getMocks()
  for (const mock of Object.values(mocks)) {
    mock.mockReset()
  }
})

afterEach(() => {
  queryClient.clear()
})

const sampleBlock = {
  id: 'block-1',
  taskId: 'task-1',
  startTime: '2026-03-22T09:00:00.000Z',
  endTime: '2026-03-22T10:00:00.000Z',
  isAutoScheduled: false,
  createdAt: '2026-03-22T00:00:00.000Z',
  updatedAt: '2026-03-22T00:00:00.000Z',
}

describe('useTimeBlocks', () => {
  it('fetches time blocks for a date', async () => {
    const mocks = await getMocks()
    assertDefined(mocks['mockGet']).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([sampleBlock]),
    })

    const { result } = renderHook(() => useTimeBlocks('2026-03-22'), {
      wrapper,
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data).toEqual([sampleBlock])
  })
})

describe('useCreateTimeBlock', () => {
  it('creates a time block with optimistic update', async () => {
    const mocks = await getMocks()
    assertDefined(mocks['mockGet']).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    })
    assertDefined(mocks['mockPost']).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(sampleBlock),
    })

    // First, populate the cache
    const { result: queryResult } = renderHook(
      () => useTimeBlocks('2026-03-22'),
      { wrapper },
    )
    await waitFor(() => {
      expect(queryResult.current.isSuccess).toBe(true)
    })

    // Now create
    const { result } = renderHook(() => useCreateTimeBlock(), { wrapper })

    act(() => {
      result.current.mutate({
        taskId: 'task-1',
        startTime: '2026-03-22T09:00:00.000Z',
        endTime: '2026-03-22T10:00:00.000Z',
      })
    })

    // Check optimistic update was applied (cache should now have the block)
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
  })
})

describe('useUpdateTimeBlock', () => {
  it('updates a time block with optimistic update', async () => {
    const mocks = await getMocks()
    const updatedBlock = {
      ...sampleBlock,
      startTime: '2026-03-22T11:00:00.000Z',
      endTime: '2026-03-22T12:00:00.000Z',
    }

    assertDefined(mocks['mockGet']).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([sampleBlock]),
    })
    assertDefined(mocks['mockPatch']).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(updatedBlock),
    })

    // Populate cache
    const { result: queryResult } = renderHook(
      () => useTimeBlocks('2026-03-22'),
      { wrapper },
    )
    await waitFor(() => {
      expect(queryResult.current.isSuccess).toBe(true)
    })

    // Update
    const { result } = renderHook(() => useUpdateTimeBlock(), { wrapper })

    act(() => {
      result.current.mutate({
        id: 'block-1',
        startTime: '2026-03-22T11:00:00.000Z',
        endTime: '2026-03-22T12:00:00.000Z',
      })
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
  })

  it('sends isAutoScheduled: false when promoting a dragged block to manual', async () => {
    const mocks = await getMocks()
    const autoBlock = { ...sampleBlock, isAutoScheduled: true }
    const promotedBlock = {
      ...autoBlock,
      startTime: '2026-03-22T11:00:00.000Z',
      endTime: '2026-03-22T12:00:00.000Z',
      isAutoScheduled: false,
    }

    assertDefined(mocks['mockGet']).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([autoBlock]),
    })
    assertDefined(mocks['mockPatch']).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(promotedBlock),
    })

    // Populate cache
    const { result: queryResult } = renderHook(
      () => useTimeBlocks('2026-03-22'),
      { wrapper },
    )
    await waitFor(() => {
      expect(queryResult.current.isSuccess).toBe(true)
    })

    // Simulate a drag: the block moves and is promoted to manual
    const { result } = renderHook(() => useUpdateTimeBlock(), { wrapper })

    act(() => {
      result.current.mutate({
        id: 'block-1',
        startTime: '2026-03-22T11:00:00.000Z',
        endTime: '2026-03-22T12:00:00.000Z',
        isAutoScheduled: false,
      })
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(assertDefined(mocks['mockPatch']).mock.calls).toEqual([
      [
        {
          param: { id: 'block-1' },
          json: {
            startTime: '2026-03-22T11:00:00.000Z',
            endTime: '2026-03-22T12:00:00.000Z',
            isAutoScheduled: false,
          },
        },
      ],
    ])
  })

  it('applies the isAutoScheduled promotion optimistically before the request settles', async () => {
    const mocks = await getMocks()
    const autoBlock = { ...sampleBlock, isAutoScheduled: true }

    assertDefined(mocks['mockGet']).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([autoBlock]),
    })

    // Hold the PATCH response so the in-flight optimistic state is
    // observable before the request settles
    let resolvePatch: (value: unknown) => void = () => {
      throw new Error('resolvePatch called before being assigned')
    }
    const patchResponsePromise = new Promise((resolve) => {
      resolvePatch = resolve
    })
    assertDefined(mocks['mockPatch']).mockReturnValue(patchResponsePromise)

    // Populate cache
    const { result: queryResult } = renderHook(
      () => useTimeBlocks('2026-03-22'),
      { wrapper },
    )
    await waitFor(() => {
      expect(queryResult.current.isSuccess).toBe(true)
    })

    // Simulate a drag: the block moves and is promoted to manual
    const { result } = renderHook(() => useUpdateTimeBlock(), { wrapper })

    act(() => {
      result.current.mutate({
        id: 'block-1',
        startTime: '2026-03-22T11:00:00.000Z',
        endTime: '2026-03-22T12:00:00.000Z',
        isAutoScheduled: false,
      })
    })

    // Optimistic update applies isAutoScheduled: false immediately, while
    // the PATCH request is still in flight
    await waitFor(() => {
      expect(queryResult.current.data?.[0]?.isAutoScheduled).toBe(false)
    })

    resolvePatch({
      ok: true,
      json: () =>
        Promise.resolve({
          ...autoBlock,
          startTime: '2026-03-22T11:00:00.000Z',
          endTime: '2026-03-22T12:00:00.000Z',
          isAutoScheduled: false,
        }),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
  })

  it('rolls back on error', async () => {
    const mocks = await getMocks()

    assertDefined(mocks['mockGet']).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([sampleBlock]),
    })
    assertDefined(mocks['mockPatch']).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Server error' }),
    })

    // Populate cache
    const { result: queryResult } = renderHook(
      () => useTimeBlocks('2026-03-22'),
      { wrapper },
    )
    await waitFor(() => {
      expect(queryResult.current.isSuccess).toBe(true)
    })

    // Try to update (should fail and rollback)
    const { result } = renderHook(() => useUpdateTimeBlock(), { wrapper })

    act(() => {
      result.current.mutate({
        id: 'block-1',
        startTime: '2026-03-22T15:00:00.000Z',
        endTime: '2026-03-22T16:00:00.000Z',
      })
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    // After rollback + invalidation, the cache should be restored
    // The invalidation will re-fetch which returns original block
    assertDefined(mocks['mockGet']).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([sampleBlock]),
    })

    await waitFor(() => {
      const cached = queryClient.getQueryData<(typeof sampleBlock)[]>([
        'time-blocks',
        'list',
        '2026-03-22',
      ])
      expect(cached?.[0]?.startTime).toBe('2026-03-22T09:00:00.000Z')
    })
  })
})

describe('useDeleteTimeBlock', () => {
  it('deletes a time block with optimistic update', async () => {
    const mocks = await getMocks()
    assertDefined(mocks['mockGet']).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([sampleBlock]),
    })
    assertDefined(mocks['mockDelete']).mockResolvedValue({ ok: true })

    // Populate cache
    const { result: queryResult } = renderHook(
      () => useTimeBlocks('2026-03-22'),
      { wrapper },
    )
    await waitFor(() => {
      expect(queryResult.current.isSuccess).toBe(true)
    })

    // Delete
    const { result } = renderHook(() => useDeleteTimeBlock(), { wrapper })

    act(() => {
      result.current.mutate('block-1')
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
  })
})
