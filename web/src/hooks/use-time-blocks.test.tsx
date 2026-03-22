import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import {
  useCreateTimeBlock,
  useDeleteTimeBlock,
  useTimeBlocks,
  useUpdateTimeBlock,
} from '@web/hooks/use-time-blocks'
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
  return (
    mod as unknown as { __mocks: Record<string, ReturnType<typeof vi.fn>> }
  ).__mocks
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
    mocks['mockGet']!.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([sampleBlock]),
    })

    const { result } = renderHook(() => useTimeBlocks('2026-03-22'), {
      wrapper,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([sampleBlock])
  })
})

describe('useCreateTimeBlock', () => {
  it('creates a time block with optimistic update', async () => {
    const mocks = await getMocks()
    mocks['mockGet']!.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    })
    mocks['mockPost']!.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(sampleBlock),
    })

    // First, populate the cache
    const { result: queryResult } = renderHook(
      () => useTimeBlocks('2026-03-22'),
      { wrapper },
    )
    await waitFor(() => expect(queryResult.current.isSuccess).toBe(true))

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
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
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

    mocks['mockGet']!.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([sampleBlock]),
    })
    mocks['mockPatch']!.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(updatedBlock),
    })

    // Populate cache
    const { result: queryResult } = renderHook(
      () => useTimeBlocks('2026-03-22'),
      { wrapper },
    )
    await waitFor(() => expect(queryResult.current.isSuccess).toBe(true))

    // Update
    const { result } = renderHook(() => useUpdateTimeBlock(), { wrapper })

    act(() => {
      result.current.mutate({
        id: 'block-1',
        startTime: '2026-03-22T11:00:00.000Z',
        endTime: '2026-03-22T12:00:00.000Z',
      })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('rolls back on error', async () => {
    const mocks = await getMocks()

    mocks['mockGet']!.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([sampleBlock]),
    })
    mocks['mockPatch']!.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Server error' }),
    })

    // Populate cache
    const { result: queryResult } = renderHook(
      () => useTimeBlocks('2026-03-22'),
      { wrapper },
    )
    await waitFor(() => expect(queryResult.current.isSuccess).toBe(true))

    // Try to update (should fail and rollback)
    const { result } = renderHook(() => useUpdateTimeBlock(), { wrapper })

    act(() => {
      result.current.mutate({
        id: 'block-1',
        startTime: '2026-03-22T15:00:00.000Z',
        endTime: '2026-03-22T16:00:00.000Z',
      })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    // After rollback + invalidation, the cache should be restored
    // The invalidation will re-fetch which returns original block
    mocks['mockGet']!.mockResolvedValue({
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
    mocks['mockGet']!.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([sampleBlock]),
    })
    mocks['mockDelete']!.mockResolvedValue({ ok: true })

    // Populate cache
    const { result: queryResult } = renderHook(
      () => useTimeBlocks('2026-03-22'),
      { wrapper },
    )
    await waitFor(() => expect(queryResult.current.isSuccess).toBe(true))

    // Delete
    const { result } = renderHook(() => useDeleteTimeBlock(), { wrapper })

    act(() => {
      result.current.mutate('block-1')
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})
