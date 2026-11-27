import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  useCreateProjectField,
  useCreateProjectFieldOption,
  useUpdateProjectField,
  useUpdateProjectFieldOption,
} from '#hooks/use-project-fields'
import { projectKeys, taskKeys } from '#lib/query-keys'

const {
  mockCreateField,
  mockCreateOption,
  mockGetFields,
  mockUpdateField,
  mockUpdateOption,
} = vi.hoisted(() => ({
  mockCreateField: vi.fn(),
  mockCreateOption: vi.fn(),
  mockGetFields: vi.fn(),
  mockUpdateField: vi.fn(),
  mockUpdateOption: vi.fn(),
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
              $patch: mockUpdateField,
              options: {
                $post: mockCreateOption,
                ':optionId': { $patch: mockUpdateOption },
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

function projectFieldMutationOutput(
  fieldOutcome: unknown,
  fieldCalls: unknown[][],
  optionOutcome: unknown,
  optionCalls: unknown[][],
  invalidationKeys: unknown[],
) {
  return {
    field: { outcome: fieldOutcome, calls: fieldCalls },
    option: { outcome: optionOutcome, calls: optionCalls },
    invalidationKeys,
  }
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
  mockUpdateField.mockReset()
  mockUpdateOption.mockReset()
})

afterEach(() => {
  queryClient.clear()
})

describe('project field mutations', () => {
  it('does not invalidate task queries after creating fields or options', async () => {
    mockCreateField.mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    mockCreateOption.mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const invalidateQueries = vi
      .spyOn(queryClient, 'invalidateQueries')
      .mockResolvedValue(undefined)
    const field = renderHook(() => useCreateProjectField('project-a'), {
      wrapper,
    })
    const option = renderHook(() => useCreateProjectFieldOption('project-a'), {
      wrapper,
    })
    let fieldOutcome: unknown
    let optionOutcome: unknown

    await act(async () => {
      fieldOutcome = await captureOutcome(
        field.result.current.mutateAsync({ name: 'NewCategory' }),
      )
      optionOutcome = await captureOutcome(
        option.result.current.mutateAsync({
          fieldId: 'field-a',
          name: 'NewChoice',
        }),
      )
    })

    expect(
      projectFieldMutationOutput(
        fieldOutcome,
        mockCreateField.mock.calls,
        optionOutcome,
        mockCreateOption.mock.calls,
        invalidateQueries.mock.calls.map(([filters]) => filters?.queryKey),
      ),
    ).toEqual({
      field: {
        outcome: { status: 'resolved', value: {} },
        calls: [
          [
            {
              param: { projectId: 'project-a' },
              json: { name: 'NewCategory' },
            },
          ],
        ],
      },
      option: {
        outcome: { status: 'resolved', value: {} },
        calls: [
          [
            {
              param: { projectId: 'project-a', fieldId: 'field-a' },
              json: { name: 'NewChoice' },
            },
          ],
        ],
      },
      invalidationKeys: [
        projectKeys.fields('project-a'),
        projectKeys.fields('project-a'),
      ],
    })
  })

  it('invalidates task queries after field and option names change', async () => {
    mockUpdateField.mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    mockUpdateOption.mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const invalidateQueries = vi
      .spyOn(queryClient, 'invalidateQueries')
      .mockResolvedValue(undefined)
    const field = renderHook(() => useUpdateProjectField('project-a'), {
      wrapper,
    })
    const option = renderHook(() => useUpdateProjectFieldOption('project-a'), {
      wrapper,
    })
    let fieldOutcome: unknown
    let optionOutcome: unknown

    await act(async () => {
      fieldOutcome = await captureOutcome(
        field.result.current.mutateAsync({
          fieldId: 'field-a',
          name: 'UpdatedCategory',
        }),
      )
      optionOutcome = await captureOutcome(
        option.result.current.mutateAsync({
          fieldId: 'field-a',
          optionId: 'option-a',
          name: 'UpdatedChoice',
        }),
      )
    })

    expect(
      projectFieldMutationOutput(
        fieldOutcome,
        mockUpdateField.mock.calls,
        optionOutcome,
        mockUpdateOption.mock.calls,
        invalidateQueries.mock.calls.map(([filters]) => filters?.queryKey),
      ),
    ).toEqual({
      field: {
        outcome: { status: 'resolved', value: {} },
        calls: [
          [
            {
              param: { projectId: 'project-a', fieldId: 'field-a' },
              json: { name: 'UpdatedCategory' },
            },
          ],
        ],
      },
      option: {
        outcome: { status: 'resolved', value: {} },
        calls: [
          [
            {
              param: {
                projectId: 'project-a',
                fieldId: 'field-a',
                optionId: 'option-a',
              },
              json: { name: 'UpdatedChoice' },
            },
          ],
        ],
      },
      invalidationKeys: [
        projectKeys.fields('project-a'),
        taskKeys.all,
        projectKeys.fields('project-a'),
        taskKeys.all,
      ],
    })
  })

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
