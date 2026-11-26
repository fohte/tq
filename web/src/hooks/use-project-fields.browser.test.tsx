import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  useCreateProjectField,
  useCreateProjectFieldOption,
} from '#hooks/use-project-fields'

const { mockCreateField, mockCreateOption, mockGetFields } = vi.hoisted(() => ({
  mockCreateField: vi.fn(),
  mockCreateOption: vi.fn(),
  mockGetFields: vi.fn(),
}))

vi.mock('#lib/api', () => ({
  api: {
    api: {
      projects: {
        ':projectId': {
          fields: {
            $get: mockGetFields,
            $post: mockCreateField,
            ':fieldId': {
              options: {
                $post: mockCreateOption,
              },
            },
          },
        },
      },
    },
  },
}))

let queryClient: QueryClient

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

function conflictResponse() {
  return new Response(JSON.stringify({ error: 'Conflict' }), {
    status: 409,
    headers: { 'Content-Type': 'application/json' },
  })
}

function captureOutcome<T>(promise: Promise<T>) {
  return promise.then(
    (value) => ({ status: 'resolved' as const, value }),
    (error: unknown) => ({
      status: 'rejected' as const,
      message: error instanceof Error ? error.message : String(error),
    }),
  )
}

function mutationOutput(
  outcome: unknown,
  calls: unknown[][],
  invalidationKeys: unknown[],
) {
  return { outcome, calls, invalidationKeys }
}

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  mockCreateField.mockReset()
  mockCreateOption.mockReset()
  mockGetFields.mockReset()
})

afterEach(() => {
  queryClient.clear()
})

describe('project field mutations', () => {
  it('maps a duplicate field name response to a user-facing error', async () => {
    mockCreateField.mockResolvedValue(conflictResponse())
    const invalidateQueries = vi
      .spyOn(queryClient, 'invalidateQueries')
      .mockResolvedValue(undefined)
    const { result } = renderHook(() => useCreateProjectField('project-a'), {
      wrapper,
    })
    let outcome: unknown

    await act(async () => {
      outcome = await captureOutcome(
        result.current.mutateAsync({ name: 'SampleCategory' }),
      )
    })

    expect(
      mutationOutput(
        outcome,
        mockCreateField.mock.calls,
        invalidateQueries.mock.calls.map(([filters]) => filters?.queryKey),
      ),
    ).toEqual({
      outcome: {
        status: 'rejected',
        message: 'このプロジェクトには同じ名前のフィールドがあります',
      },
      calls: [
        [
          {
            param: { projectId: 'project-a' },
            json: { name: 'SampleCategory' },
          },
        ],
      ],
      invalidationKeys: [],
    })
  })

  it('maps a duplicate option name response to a user-facing error', async () => {
    mockCreateOption.mockResolvedValue(conflictResponse())
    const invalidateQueries = vi
      .spyOn(queryClient, 'invalidateQueries')
      .mockResolvedValue(undefined)
    const { result } = renderHook(
      () => useCreateProjectFieldOption('project-a'),
      { wrapper },
    )
    let outcome: unknown

    await act(async () => {
      outcome = await captureOutcome(
        result.current.mutateAsync({ fieldId: 'field-a', name: 'OptionA' }),
      )
    })

    expect(
      mutationOutput(
        outcome,
        mockCreateOption.mock.calls,
        invalidateQueries.mock.calls.map(([filters]) => filters?.queryKey),
      ),
    ).toEqual({
      outcome: {
        status: 'rejected',
        message: 'このフィールドには同じ名前の選択肢があります',
      },
      calls: [
        [
          {
            param: { projectId: 'project-a', fieldId: 'field-a' },
            json: { name: 'OptionA' },
          },
        ],
      ],
      invalidationKeys: [],
    })
  })
})
