import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { Mock } from 'vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useLabelCounts } from '#hooks/use-labels'
import { makeTagCount } from '#lib/tag-tree-test-fixtures'

vi.mock('#lib/api', () => {
  const mockGet = vi.fn()
  return {
    api: { api: { labels: { counts: { $get: mockGet } } } },
    __mocks: { mockGet },
  }
})

async function getMockGet() {
  const mod = await import('#lib/api')
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- accessing test-only __mocks property injected by vi.mock
  const typed = mod as unknown as { __mocks: { mockGet: Mock } }
  return typed.__mocks.mockGet
}

let queryClient: QueryClient

function outputOf<T>(data: T | undefined, calls: unknown[][]) {
  return { data, calls }
}

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

beforeEach(async () => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const mockGet = await getMockGet()
  mockGet.mockReset()
})

describe('useLabelCounts', () => {
  it('requests counts for the selected context', async () => {
    const mockGet = await getMockGet()
    const counts = [makeTagCount({ name: 'team', count: 2 })]
    mockGet.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(counts),
    })

    const { result } = renderHook(() => useLabelCounts('work'), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(outputOf(result.current.data, mockGet.mock.calls)).toEqual({
      data: counts,
      calls: [[{ query: { context: 'work' } }]],
    })
  })
})
