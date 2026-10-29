import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RecurringTemplateCreateModal } from '#components/recurring/recurring-template-create-modal'
import { makeRecurringTemplate } from '#components/recurring/recurring-template-test-fixtures'
import { resetSessionOpenSettings } from '#hooks/session-open-settings-test-fixtures'
import { labelKeys } from '#lib/query-keys'
import { renderControlledModal } from '#lib/render-controlled-modal'
import { assertDefined, findVisible } from '#lib/test-utils'

const { postRecurringTemplate } = vi.hoisted(() => ({
  postRecurringTemplate:
    vi.fn<(input: { json: unknown }) => Promise<Response>>(),
}))

vi.mock('#lib/api', () => ({
  api: {
    api: {
      'recurring-task-templates': {
        $post: postRecurringTemplate,
      },
    },
  },
}))

function postedRequestBodies() {
  return postRecurringTemplate.mock.calls.map(([input]) => input.json)
}

function successfulCreateState() {
  return {
    requestBodies: postedRequestBodies(),
    modalOpen: screen.queryByPlaceholderText('Template title') != null,
  }
}

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  })
}

function setSuccessfulCreateResponse() {
  postRecurringTemplate.mockReset()
  postRecurringTemplate.mockResolvedValue(jsonResponse(makeRecurringTemplate()))
}

function createQueryClient() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  })
  queryClient.setQueryData(labelKeys.list({ context: 'work' }), [])
  queryClient.setQueryData(labelKeys.list({ context: 'personal' }), [])
  return queryClient
}

function renderModal() {
  return renderControlledModal(
    RecurringTemplateCreateModal,
    {},
    { queryClient: createQueryClient() },
  )
}

function visibleButton(name: string) {
  return assertDefined(
    findVisible(screen.getAllByRole('button', { name })),
    `no visible button named ${name}`,
  )
}

function pastDateState() {
  return {
    date: assertDefined(
      findVisible(
        screen.getAllByLabelText<HTMLInputElement>('First task date'),
      ),
    ).value,
    createDisabled: visibleButton('Create Template').hasAttribute('disabled'),
    error: screen.queryByRole('alert')?.textContent ?? null,
  }
}

function unmatchedRuleState() {
  return {
    createDisabled: visibleButton('Create Template').hasAttribute('disabled'),
    error: screen.getByRole('alert').textContent,
  }
}

describe('RecurringTemplateCreateModal', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-03-20T12:00:00'))
    resetSessionOpenSettings({ localContext: 'personal' })
    setSuccessfulCreateResponse()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('sends the complete POST body for the entered template fields', async () => {
    const user = userEvent.setup()
    renderModal()

    await user.type(
      assertDefined(
        findVisible(screen.getAllByPlaceholderText('Template title')),
      ),
      'Weekly review',
    )
    await user.type(
      assertDefined(findVisible(screen.getAllByPlaceholderText('Description'))),
      'Review the project status',
    )
    fireEvent.change(
      assertDefined(findVisible(screen.getAllByLabelText('First task date'))),
      { target: { value: '2026-03-25' } },
    )
    await user.click(visibleButton('+ add tag'))
    await user.type(
      assertDefined(findVisible(screen.getAllByPlaceholderText('tag name'))),
      'planning',
    )
    await user.keyboard('{Enter}')
    await user.click(visibleButton('Create Template'))

    await waitFor(() => {
      expect(successfulCreateState()).toEqual({
        requestBodies: [
          {
            title: 'Weekly review',
            description: 'Review the project status',
            context: 'personal',
            labels: ['planning'],
            recurrenceRule: { type: 'daily', interval: 1 },
            anchorDate: '2026-03-24',
          },
        ],
        modalOpen: false,
      })
    })
  })

  it('blocks a date before today', () => {
    renderModal()
    fireEvent.change(
      assertDefined(findVisible(screen.getAllByLabelText('First task date'))),
      { target: { value: '2026-03-19' } },
    )

    expect(pastDateState()).toEqual({
      date: '2026-03-19',
      createDisabled: true,
      error: 'First task date must be today or later.',
    })
  })

  it('defaults the first task date to today when reopened', () => {
    const queryClient = createQueryClient()
    const renderAt = (open: boolean) => (
      <QueryClientProvider client={queryClient}>
        <RecurringTemplateCreateModal open={open} onOpenChange={() => {}} />
      </QueryClientProvider>
    )
    const { rerender } = render(renderAt(true))

    fireEvent.change(
      assertDefined(findVisible(screen.getAllByLabelText('First task date'))),
      { target: { value: '2026-03-20' } },
    )
    rerender(renderAt(false))
    vi.setSystemTime(new Date('2026-03-21T12:00:00'))
    rerender(renderAt(true))

    expect(pastDateState()).toEqual({
      date: '2026-03-21',
      createDisabled: true,
      error: null,
    })
  })

  it('blocks a first date that does not match the weekly rule', async () => {
    const user = userEvent.setup()
    renderModal()
    fireEvent.change(
      assertDefined(findVisible(screen.getAllByLabelText('First task date'))),
      { target: { value: '2026-03-23' } },
    )

    await user.click(
      assertDefined(findVisible(screen.getAllByRole('combobox'))),
    )
    await user.click(await screen.findByRole('option', { name: 'Weekly' }))
    await user.click(visibleButton('T'))

    expect(unmatchedRuleState()).toEqual({
      createDisabled: true,
      error: 'The first date does not match the recurrence rule.',
    })
  })
})
