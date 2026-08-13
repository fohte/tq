import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { CreateScheduleModal } from '#components/schedule/create-schedule-modal'
import type { Schedule } from '#hooks/use-schedules'
import {
  useCreateSchedule,
  useDeleteSchedule,
  useUpdateSchedule,
} from '#hooks/use-schedules'
import { renderControlledModal } from '#lib/render-controlled-modal'
import { assertDefined, atIndex } from '#lib/test-utils'

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

function partialMutation<T>(partial: Partial<T>): T {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- partial mock of hook return value
  return partial as T
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

const sampleSchedule: Schedule = {
  scheduleId: 'schedule-1',
  title: 'Gym',
  start: '2026-01-01T07:00:00',
  end: '2026-01-01T08:00:00',
  context: 'personal',
  color: '#6C63FF',
  recurrence: {
    id: 'rule-1',
    type: 'weekly',
    interval: 1,
    daysOfWeek: [1, 3, 5],
    dayOfMonth: null,
  },
}

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

  it('pre-fills the form with the schedule being edited', () => {
    setupMocks()
    renderControlledModal(CreateScheduleModal, { schedule: sampleSchedule })

    const titleInputs = screen.getAllByPlaceholderText('Schedule title')
    expect(atIndex(titleInputs, 0)).toHaveValue('Gym')
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
    renderControlledModal(CreateScheduleModal, {})

    const titleInputs = screen.getAllByPlaceholderText('Schedule title')
    await user.type(atIndex(titleInputs, 0), 'Team sync')

    const timeInputs = Array.from(
      document.body.querySelectorAll<HTMLInputElement>('input[type="time"]'),
    )
    fireEvent.change(atIndex(timeInputs, 0), { target: { value: '09:00' } })
    fireEvent.change(atIndex(timeInputs, 1), { target: { value: '09:30' } })

    await user.click(screen.getByRole('button', { name: 'Create Schedule' }))

    expect(createMutate).toHaveBeenCalledTimes(1)
    expect(assertDefined(createMutate.mock.calls[0])[0]).toEqual({
      title: 'Team sync',
      startTime: '09:00',
      endTime: '09:30',
    })
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

    expect(updateMutate).toHaveBeenCalledTimes(1)
    expect(assertDefined(updateMutate.mock.calls[0])[0]).toEqual({
      id: 'schedule-1',
      input: {
        title: 'Morning run',
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
    })
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
