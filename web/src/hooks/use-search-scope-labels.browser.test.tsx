import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { Mock } from 'vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { makeProjectDetail } from '#components/project/project-test-fixtures'
import { makeTaskDetail } from '#components/task/task-row-test-fixtures'
import { projectKeys } from '#hooks/use-projects'
import { useSearchScopeLabels } from '#hooks/use-search-scope-labels'
import { taskKeys } from '#hooks/use-task-queries'

vi.mock('#lib/api', () => {
  const mockProjectGet = vi.fn()
  const mockTaskGet = vi.fn()
  return {
    api: {
      api: {
        projects: { ':id': { $get: mockProjectGet } },
        tasks: { ':id': { $get: mockTaskGet } },
      },
    },
    __mocks: { mockProjectGet, mockTaskGet },
  }
})

async function getMocks() {
  const mod = await import('#lib/api')
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- accessing test-only __mocks property injected by vi.mock
  const typed = mod as unknown as {
    __mocks: { mockProjectGet: Mock; mockTaskGet: Mock }
  }
  return typed.__mocks
}

let queryClient: QueryClient
let mocks: Awaited<ReturnType<typeof getMocks>>

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

beforeEach(async () => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  mocks = await getMocks()
  mocks.mockProjectGet.mockReset()
  mocks.mockTaskGet.mockReset()
})

function jsonResponse(body: unknown) {
  return { ok: true, json: () => Promise.resolve(body) }
}

describe('useSearchScopeLabels', () => {
  it('resolves project and parent names from detail queries', async () => {
    const projectId = 'project-id'
    const parentId = 'task-id'
    const scopeTokens = [
      `project:"${projectId}"`,
      `parent:${parentId}`,
      `parent:"${parentId}"`,
    ]
    mocks.mockProjectGet.mockResolvedValue(
      jsonResponse(makeProjectDetail({ id: projectId, title: 'Roadmap' })),
    )
    mocks.mockTaskGet.mockResolvedValue(
      jsonResponse(
        makeTaskDetail({ id: parentId, number: 42, title: 'Prepare release' }),
      ),
    )

    const { result } = renderHook(
      () => useSearchScopeLabels(scopeTokens, true),
      { wrapper },
    )

    await waitFor(() => {
      expect(result.current).toEqual([
        {
          token: `project:"${projectId}"`,
          label: 'project:Roadmap',
        },
        {
          token: `parent:${parentId}`,
          label: 'parent:#42 Prepare release',
        },
        {
          token: `parent:"${parentId}"`,
          label: 'parent:#42 Prepare release',
        },
      ])
    })
    expect(mocks.mockTaskGet.mock.calls).toEqual([
      [{ param: { id: parentId } }],
    ])
  })

  it('keeps raw tokens when detail lookups fail', async () => {
    const projectId = 'missing-project'
    const parentId = 'missing-task'
    mocks.mockProjectGet.mockRejectedValue(new Error('Not found'))
    mocks.mockTaskGet.mockRejectedValue(new Error('Not found'))

    const { result } = renderHook(
      () =>
        useSearchScopeLabels(
          [`project:${projectId}`, `parent:${parentId}`],
          true,
        ),
      { wrapper },
    )

    await waitFor(() => {
      if (
        queryClient.getQueryState(projectKeys.detail(projectId))?.status !==
          'error' ||
        queryClient.getQueryState(taskKeys.detail(parentId))?.status !== 'error'
      ) {
        throw new Error('Waiting for detail lookups to fail')
      }
    })

    expect(result.current).toEqual([
      { token: `project:${projectId}`, label: `project:${projectId}` },
      { token: `parent:${parentId}`, label: `parent:${parentId}` },
    ])
  })

  it('does not fetch detail records while disabled', () => {
    const scopeTokens = ['project:project-id', 'parent:task-id']

    const { result } = renderHook(
      () => useSearchScopeLabels(scopeTokens, false),
      { wrapper },
    )

    expect(result.current).toEqual(
      scopeTokens.map((token) => ({ token, label: token })),
    )
    expect(mocks.mockProjectGet.mock.calls).toEqual([])
    expect(mocks.mockTaskGet.mock.calls).toEqual([])
  })
})
