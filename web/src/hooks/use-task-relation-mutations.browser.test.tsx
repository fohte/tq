import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { makeTask } from '#components/task/task-row-test-fixtures'
import { projectKeys } from '#hooks/use-projects'
import { taskKeys } from '#hooks/use-task-queries'
import { useUpdateTaskBlockedBy } from '#hooks/use-task-relation-mutations'

const { patchTask } = vi.hoisted(() => ({ patchTask: vi.fn() }))

vi.mock('#lib/api', () => ({
  api: { api: { tasks: { ':id': { $patch: patchTask } } } },
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
})
