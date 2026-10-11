import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'

import { CreateScheduleModal } from '#components/schedule/create-schedule-modal'
import { makeSchedule } from '#components/schedule/schedule-test-fixtures'
import {
  useCreateSchedule,
  useDeleteSchedule,
  useUpdateSchedule,
} from '#hooks/use-schedules'
import { renderControlledModal } from '#lib/render-controlled-modal'
import {
  assertDefined,
  atIndex,
  findVisible,
  partialMutation,
} from '#lib/test-utils'
import {
  DESKTOP_VIEWPORT,
  MOBILE_VIEWPORT,
} from '#storybook-config/screenshot-viewports'

vi.mock('#hooks/use-schedules', async (importOriginal) => {
  const original = await importOriginal<typeof import('#hooks/use-schedules')>()
  return {
    ...original,
    useCreateSchedule: vi.fn(),
    useUpdateSchedule: vi.fn(),
    useDeleteSchedule: vi.fn(),
  }
})

const mockUseCreateSchedule = vi.mocked(useCreateSchedule)
const mockUseUpdateSchedule = vi.mocked(useUpdateSchedule)
const mockUseDeleteSchedule = vi.mocked(useDeleteSchedule)

function dateInputState(input: HTMLInputElement) {
  return { type: input.type, value: input.value }
}

function setupMocks() {
  const createMutate = vi.fn()
  const updateMutate = vi.fn()
  const deleteMutate = vi.fn()

  mockUseCreateSchedule.mockReturnValue(
    partialMutation<ReturnType<typeof useCreateSchedule>>({
      mutate: createMutate,
      isPending: false,
    }),
  )
  mockUseUpdateSchedule.mockReturnValue(
    partialMutation<ReturnType<typeof useUpdateSchedule>>({
      mutate: updateMutate,
      isPending: false,
    }),
  )
  mockUseDeleteSchedule.mockReturnValue(
    partialMutation<ReturnType<typeof useDeleteSchedule>>({
      mutate: deleteMutate,
      isPending: false,
    }),
  )

  return { createMutate, updateMutate, deleteMutate }
}

function normalizeMutationCalls(calls: readonly unknown[][]) {
  return calls.map(([input, options]) => {
    const normalizedOptions =
      typeof options === 'object' && options !== null && 'onSuccess' in options
        ? {
            ...options,
            onSuccess:
              typeof options.onSuccess === 'function'
                ? 'callback'
                : options.onSuccess,
          }
        : options

    return [input, normalizedOptions]
  })
}

const sampleSchedule = makeSchedule()

describe('CreateScheduleModal', () => {
  it('removes the modal from the DOM when the close (X) button is clicked', async () => {
    setupMocks()
    const user = userEvent.setup()
    renderControlledModal(CreateScheduleModal, {})

    const closeButtons = screen.getAllByRole('button', { name: 'Close' })
    await user.click(atIndex(closeButtons, 0))

    await waitFor(() => {
      expect(
        screen.queryByPlaceholderText('Schedule title'),
      ).not.toBeInTheDocument()
    })
  })

  it('removes the modal from the DOM when the Cancel button is clicked', async () => {
    setupMocks()
    const user = userEvent.setup()
    renderControlledModal(CreateScheduleModal, {})

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await waitFor(() => {
      expect(
        screen.queryByPlaceholderText('Schedule title'),
      ).not.toBeInTheDocument()
    })
  })

  it('closes when the desktop backdrop is clicked', async () => {
    setupMocks()
    const user = userEvent.setup()
    const { onOpenChange } = renderControlledModal(CreateScheduleModal, {})

    await user.click(
      assertDefined(document.elementFromPoint(1, 1), 'no target at backdrop'),
    )

    expect(onOpenChange.mock.calls).toEqual([[false]])
  })

  it('closes when a click reaches the mobile backdrop', async () => {
    await page.viewport(MOBILE_VIEWPORT.width, MOBILE_VIEWPORT.height)
    setupMocks()
    const { onOpenChange } = renderControlledModal(CreateScheduleModal, {})
    const user = userEvent.setup()
    await user.click(
      assertDefined(document.elementFromPoint(1, 1), 'no target at backdrop'),
    )

    expect(onOpenChange.mock.calls).toEqual([[false]])
  })

  it.each([
    ['desktop', DESKTOP_VIEWPORT],
    ['mobile', MOBILE_VIEWPORT],
  ] as const)(
    'stays open when a title field is clicked inside the %s panel',
    async (_viewportName, viewport) => {
      await page.viewport(viewport.width, viewport.height)
      setupMocks()
      const user = userEvent.setup()
      const { onOpenChange } = renderControlledModal(CreateScheduleModal, {})
      const titleInput = assertDefined(
        findVisible(screen.getAllByPlaceholderText('Schedule title')),
        'no visible schedule title input',
      )

      await user.click(titleInput)

      expect(onOpenChange.mock.calls).toEqual([])
    },
  )

  it('pre-fills the title input with the schedule being edited', () => {
    setupMocks()
    renderControlledModal(CreateScheduleModal, { schedule: sampleSchedule })

    const titleInputs = screen.getAllByPlaceholderText('Schedule title')
    expect(atIndex(titleInputs, 0)).toHaveValue('Gym')
  })

  it('pre-fills the start date from the schedule being edited', () => {
    setupMocks()
    renderControlledModal(CreateScheduleModal, { schedule: sampleSchedule })

    expect(
      assertDefined(
        findVisible(screen.getAllByLabelText('Start date')),
        'no visible schedule start date input',
      ),
    ).toHaveValue('2026-01-01')
  })

  it('reveals the start date input from the date chip on mobile', async () => {
    await page.viewport(MOBILE_VIEWPORT.width, MOBILE_VIEWPORT.height)
    setupMocks()
    const user = userEvent.setup()
    renderControlledModal(CreateScheduleModal, {
      defaultStartDate: '2026-07-20',
    })

    await user.click(screen.getByRole('button', { name: '2026-07-20' }))

    const startDateInputs = screen
      .getAllByLabelText('Start date')
      .filter(
        (element): element is HTMLInputElement =>
          element instanceof HTMLInputElement,
      )
    const startDateInput = assertDefined(
      findVisible(startDateInputs),
      'no visible schedule start date input',
    )
    expect(dateInputState(startDateInput)).toEqual({
      type: 'date',
      value: '2026-07-20',
    })
  })

  it('uses the selected calendar day when a new schedule modal opens', async () => {
    setupMocks()
    const user = userEvent.setup()
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    function ScheduleModalHarness() {
      const [open, setOpen] = useState(false)
      const [selectedDate, setSelectedDate] = useState('2026-07-20')

      return (
        <QueryClientProvider client={queryClient}>
          <button
            onClick={() => {
              setSelectedDate('2026-07-22')
            }}
          >
            Move to July 22
          </button>
          <button
            onClick={() => {
              setOpen(true)
            }}
          >
            New schedule
          </button>
          <CreateScheduleModal
            open={open}
            onOpenChange={setOpen}
            defaultStartDate={selectedDate}
          />
        </QueryClientProvider>
      )
    }

    render(<ScheduleModalHarness />)

    await user.click(screen.getByRole('button', { name: 'Move to July 22' }))
    await user.click(screen.getByRole('button', { name: 'New schedule' }))

    expect(
      assertDefined(
        findVisible(screen.getAllByLabelText('Start date')),
        'no visible schedule start date input',
      ),
    ).toHaveValue('2026-07-22')
  })

  it('does not show a delete button when creating a new schedule', () => {
    setupMocks()
    renderControlledModal(CreateScheduleModal, {})

    expect(
      screen.queryByRole('button', { name: 'Delete schedule' }),
    ).not.toBeInTheDocument()
  })

  it('creates a new schedule with the entered values when Create Schedule is clicked', async () => {
    const { createMutate } = setupMocks()
    const user = userEvent.setup()
    renderControlledModal(CreateScheduleModal, {
      defaultStartDate: '2026-07-20',
    })

    fireEvent.change(
      assertDefined(
        findVisible(screen.getAllByLabelText('Start date')),
        'no visible schedule start date input',
      ),
      { target: { value: '2026-07-21' } },
    )

    const titleInputs = screen.getAllByPlaceholderText('Schedule title')
    await user.type(atIndex(titleInputs, 0), 'Team sync')

    const startTimeInputs = screen.getAllByLabelText('Start time')
    fireEvent.change(atIndex(startTimeInputs, 0), {
      target: { value: '09:00' },
    })
    const endTimeInputs = screen.getAllByLabelText('End time')
    fireEvent.change(atIndex(endTimeInputs, 0), { target: { value: '09:30' } })

    await user.click(screen.getByRole('button', { name: 'Create Schedule' }))

    expect(normalizeMutationCalls(createMutate.mock.calls)).toEqual([
      [
        {
          title: 'Team sync',
          startDate: '2026-07-21',
          startTime: '09:00',
          endTime: '09:30',
        },
        { onSuccess: 'callback' },
      ],
    ])
  })

  it('updates the schedule with the edited values when Save is clicked', async () => {
    const { updateMutate } = setupMocks()
    const user = userEvent.setup()
    renderControlledModal(CreateScheduleModal, { schedule: sampleSchedule })

    const titleInputs = screen.getAllByPlaceholderText('Schedule title')
    const titleInput = atIndex(titleInputs, 0)
    await user.clear(titleInput)
    await user.type(titleInput, 'Morning run')

    const saveButtons = screen.getAllByRole('button', { name: 'Save' })
    await user.click(atIndex(saveButtons, 0))

    expect(normalizeMutationCalls(updateMutate.mock.calls)).toEqual([
      [
        {
          id: 'schedule-1',
          input: {
            title: 'Morning run',
            startDate: '2026-01-01',
            startTime: '07:00',
            endTime: '08:00',
            recurrence: {
              type: 'weekly',
              interval: 1,
              daysOfWeek: [1, 3, 5],
            },
            context: 'personal',
            color: '#6C63FF',
          },
        },
        { onSuccess: 'callback' },
      ],
    ])
  })

  it('deletes the schedule when the delete button is confirmed', async () => {
    const { deleteMutate } = setupMocks()
    const user = userEvent.setup()
    renderControlledModal(CreateScheduleModal, { schedule: sampleSchedule })

    const deleteTriggers = screen.getAllByRole('button', {
      name: 'Delete schedule',
    })
    await user.click(atIndex(deleteTriggers, 0))

    const confirmButtons = screen.getAllByRole('button', { name: 'Delete' })
    await user.click(atIndex(confirmButtons, 0))

    expect(deleteMutate).toHaveBeenCalledTimes(1)
    expect(assertDefined(deleteMutate.mock.calls[0])[0]).toBe('schedule-1')
  })
})
