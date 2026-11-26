import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { Mock } from 'vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { makePrioritySettings } from '#components/task/priority-settings-test-fixtures'
import {
  type UpdatePrioritySettingsInput,
  useUpdatePrioritySettings,
} from '#hooks/use-priority-settings'
import { prioritySettingsKeys, queueKeys, taskKeys } from '#lib/query-keys'

vi.mock('#lib/api', () => {
  const update = vi.fn()

  return {
    api: {
      api: {
        'priority-settings': { $put: update },
      },
    },
    __mocks: { update },
  }
})

interface ApiMocks {
  update: Mock
}

async function getMocks(): Promise<ApiMocks> {
  const mod = await import('#lib/api')
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- accessing test-only __mocks property injected by vi.mock
  const typed = mod as unknown as { __mocks: ApiMocks }
  return typed.__mocks
}

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: () => Promise.resolve(body) }
}

let queryClient: QueryClient
let mocks: ApiMocks

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
  mocks.update.mockReset()
})

describe('useUpdatePrioritySettings', () => {
  it('saves the full settings and refreshes dependent caches', async () => {
    const original = makePrioritySettings()
    const input: UpdatePrioritySettingsInput = original.map(
      (setting, sortOrder) => ({ ...setting, sortOrder: 4 - sortOrder }),
    )
    const response = [...input].sort(
      (left, right) => left.sortOrder - right.sortOrder,
    )
    mocks.update.mockResolvedValue(jsonResponse(response))
    queryClient.setQueryData(prioritySettingsKeys.all, original)
    queryClient.setQueryData(taskKeys.all, ['stale task data'])
    queryClient.setQueryData(queueKeys.all, ['stale queue data'])

    const update = renderHook(() => useUpdatePrioritySettings(), { wrapper })
    await act(async () => {
      await update.result.current.mutateAsync(input)
    })

    const result = () => ({
      requestCalls: mocks.update.mock.calls,
      prioritySettings: queryClient.getQueryData(prioritySettingsKeys.all),
      taskCacheInvalidated: queryClient.getQueryState(taskKeys.all)
        ?.isInvalidated,
      queueCacheInvalidated: queryClient.getQueryState(queueKeys.all)
        ?.isInvalidated,
    })
    expect(result()).toEqual({
      requestCalls: [[{ json: input }]],
      prioritySettings: response,
      taskCacheInvalidated: true,
      queueCacheInvalidated: true,
    })
  })
})
