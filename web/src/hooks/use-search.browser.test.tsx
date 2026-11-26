import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { makeSuggestion } from '#components/search/search-test-fixtures'
import { makePrioritySettings } from '#components/task/priority-settings-test-fixtures'
import { makeTaskDetail } from '#components/task/task-row-test-fixtures'
import {
  useSearchSuggestions,
  useSearchTaskByIdOrNumber,
  useSearchTasks,
} from '#hooks/use-search'

const {
  mockGetTasks,
  mockGetTaskById,
  mockGetSuggestions,
  mockGetPrioritySettings,
} = vi.hoisted(() => ({
  mockGetTasks: vi.fn(),
  mockGetTaskById: vi.fn(),
  mockGetSuggestions: vi.fn(),
  mockGetPrioritySettings: vi.fn(),
}))

vi.mock('#lib/api', () => ({
  api: {
    api: {
      tasks: {
        $get: mockGetTasks,
        ':id': { $get: mockGetTaskById },
        search: { suggest: { $get: mockGetSuggestions } },
      },
      'priority-settings': { $get: mockGetPrioritySettings },
    },
  },
}))

let queryClient: QueryClient

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  mockGetTaskById.mockReset()
  mockGetTasks.mockReset()
  mockGetSuggestions.mockReset()
  mockGetPrioritySettings.mockReset()
  mockGetTasks.mockResolvedValue(
    new Response('[]', {
      headers: { 'Content-Type': 'application/json' },
    }),
  )
  mockGetSuggestions.mockResolvedValue(
    new Response('[]', {
      headers: { 'Content-Type': 'application/json' },
    }),
  )
  mockGetPrioritySettings.mockResolvedValue(
    new Response('[]', {
      headers: { 'Content-Type': 'application/json' },
    }),
  )
})

afterEach(() => {
  queryClient.clear()
  vi.useRealTimers()
})

describe('useSearchTasks', () => {
  it('requests full task rows with match snippets for free-text queries', async () => {
    renderHook(() => useSearchTasks('needle'), { wrapper })

    await waitFor(() => {
      expect(mockGetTasks.mock.calls).toEqual([
        [
          {
            query: {
              view: 'row',
              q: 'needle',
              limit: '20',
              context: 'all',
              status: 'all',
              includeMatch: 'true',
            },
          },
        ],
      ])
    })
  })
})

describe('useSearchSuggestions', () => {
  it.each([
    {
      prefix: 'p',
      expectedSuggestions: [
        { value: 'priority:-1', display: 'Elm', category: 'priority' },
        { value: 'priority:none', display: 'Dahlia', category: 'priority' },
        { value: 'priority:0', display: 'Cedar', category: 'priority' },
        { value: 'priority:1', display: 'Birch', category: 'priority' },
        { value: 'priority:2', display: 'Aster', category: 'priority' },
      ],
    },
    {
      prefix: 'priority:2',
      expectedSuggestions: [
        { value: 'priority:2', display: 'Aster', category: 'priority' },
      ],
    },
    {
      prefix: 'priority:n',
      expectedSuggestions: [
        { value: 'priority:none', display: 'Dahlia', category: 'priority' },
      ],
    },
  ])(
    'loads configured priority names for the prefix $prefix',
    async ({ prefix, expectedSuggestions }) => {
      const names = ['Aster', 'Birch', 'Cedar', 'Dahlia', 'Elm']
      const prioritySettings = makePrioritySettings().map((setting, index) => ({
        ...setting,
        name: names[index] ?? setting.name,
        sortOrder: 4 - index,
      }))
      const suggestions = [
        makeSuggestion({
          value: 'priority:2',
          display: 'Priority 2',
          category: 'priority',
        }),
        makeSuggestion({
          value: 'priority:1',
          display: 'Priority 1',
          category: 'priority',
        }),
        makeSuggestion({
          value: 'priority:0',
          display: 'Priority 0',
          category: 'priority',
        }),
        makeSuggestion({
          value: 'priority:none',
          display: 'Inbox',
          category: 'priority',
        }),
        makeSuggestion({
          value: 'priority:-1',
          display: 'Priority -1',
          category: 'priority',
        }),
      ]
      const matchingSuggestions = suggestions.filter(({ value }) =>
        value.startsWith(prefix),
      )
      mockGetSuggestions.mockResolvedValue(
        new Response(JSON.stringify(matchingSuggestions), {
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      mockGetPrioritySettings.mockResolvedValue(
        new Response(JSON.stringify(prioritySettings), {
          headers: { 'Content-Type': 'application/json' },
        }),
      )

      const { result } = renderHook(() => useSearchSuggestions(prefix), {
        wrapper,
      })
      const getSnapshot = () => ({
        data: result.current.data,
        suggestionCalls: mockGetSuggestions.mock.calls,
        settingsCalls: mockGetPrioritySettings.mock.calls,
      })

      await waitFor(() => {
        expect(getSnapshot()).toEqual({
          data: expectedSuggestions,
          suggestionCalls: [[{ query: { prefix } }]],
          settingsCalls: [[]],
        })
      })
    },
  )
})

describe('useSearchTaskByIdOrNumber', () => {
  it('requests the task identified by a task URL', async () => {
    const taskId = '00000000-0000-4000-8000-000000000011'
    mockGetTaskById.mockResolvedValue(
      new Response(JSON.stringify(makeTaskDetail({ id: taskId })), {
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    renderHook(
      () =>
        useSearchTaskByIdOrNumber(`https://${location.host}/tasks/${taskId}`),
      { wrapper },
    )

    await waitFor(() => {
      expect(mockGetTaskById.mock.calls).toEqual([[{ param: { id: taskId } }]])
    })
  })
})
