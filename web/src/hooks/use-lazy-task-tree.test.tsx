import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { makeNode, makeTask } from '#components/task/task-row-test-fixtures'
import { useLazyTaskTree } from '#hooks/use-lazy-task-tree'

// vi.hoisted is required: this file's imports transitively reach
// '#hooks/use-tasks' before a plain top-level const would initialize.
const { mockFetchTaskList } = vi.hoisted(() => ({
  mockFetchTaskList: vi.fn(),
}))

vi.mock('#hooks/use-tasks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#hooks/use-tasks')>()
  return {
    ...actual,
    fetchTaskList: mockFetchTaskList,
  }
})

let queryClient: QueryClient

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  vi.clearAllMocks()
  mockFetchTaskList.mockResolvedValue([])
})

describe('useLazyTaskTree', () => {
  it('returns rootTree as-is and derives hasChildren from children.length when lazyChildrenFilter is undefined', () => {
    const withChildren = makeNode({
      id: 'a',
      children: [makeNode({ id: 'a-1', parentId: 'a' })],
      childCompletionCount: { completed: 0, total: 0 },
    })
    const leaf = makeNode({
      id: 'b',
      children: [],
      childCompletionCount: { completed: 1, total: 5 },
    })
    const rootTree = [withChildren, leaf]

    const { result } = renderHook(() => useLazyTaskTree(rootTree, undefined), {
      wrapper,
    })

    expect(result.current.tree).toBe(rootTree)
    expect(result.current.hasChildren(withChildren)).toBe(true)
    expect(result.current.hasChildren(leaf)).toBe(false)
  })

  it('starts fully collapsed with hasChildren driven by childCompletionCount.total when lazyChildrenFilter is set', () => {
    const root = makeNode({
      id: 'root-1',
      childCompletionCount: { completed: 0, total: 2 },
    })

    const { result } = renderHook(
      () => useLazyTaskTree([root], { q: 'is:todo' }),
      { wrapper },
    )

    expect(result.current.isExpanded('root-1')).toBe(false)
    expect(result.current.hasChildren(root)).toBe(true)
  })

  it('fetches a node children scoped to the filter and parentId, and merges them into the tree, when toggleExpand is called', async () => {
    const root = makeNode({
      id: 'root-1',
      childCompletionCount: { completed: 0, total: 1 },
    })
    const child = makeTask({
      id: 'child-1',
      parentId: 'root-1',
      title: 'Lazily fetched child',
    })
    mockFetchTaskList.mockImplementation((filter?: { parentId?: string }) =>
      Promise.resolve(filter?.parentId === 'root-1' ? [child] : []),
    )

    const { result } = renderHook(
      () => useLazyTaskTree([root], { q: 'is:todo' }),
      { wrapper },
    )

    act(() => {
      result.current.toggleExpand('root-1')
    })

    await waitFor(() => {
      expect(result.current.tree).toEqual([
        { ...root, children: [{ ...child, children: [] }] },
      ])
    })

    expect(mockFetchTaskList).toHaveBeenCalledWith({
      q: 'is:todo',
      parentId: 'root-1',
    })
    expect(result.current.isExpanded('root-1')).toBe(true)
  })
})
