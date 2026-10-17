import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'

import { CreateScheduleModal } from '#components/schedule/create-schedule-modal'
import {
  makeSchedule,
  makeScheduleOverride,
} from '#components/schedule/schedule-test-fixtures'
import {
  useClearScheduleOverride,
  useCreateSchedule,
  useDeleteSchedule,
  useScheduleChangePreview,
  useScheduleDetails,
  useScheduleOverrides,
  useSetScheduleOverride,
  useUpdateSchedule,
} from '#hooks/use-schedules'
import { formatLocalDate } from '#lib/date-range'
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
    useScheduleDetails: vi.fn(),
    useScheduleOverrides: vi.fn(),
    useScheduleChangePreview: vi.fn(),
    useSetScheduleOverride: vi.fn(),
    useClearScheduleOverride: vi.fn(),
  }
})

const mockUseCreateSchedule = vi.mocked(useCreateSchedule)
const mockUseUpdateSchedule = vi.mocked(useUpdateSchedule)
const mockUseDeleteSchedule = vi.mocked(useDeleteSchedule)
const mockUseScheduleDetails = vi.mocked(useScheduleDetails)
const mockUseScheduleOverrides = vi.mocked(useScheduleOverrides)
const mockUseScheduleChangePreview = vi.mocked(useScheduleChangePreview)
const mockUseSetScheduleOverride = vi.mocked(useSetScheduleOverride)
const mockUseClearScheduleOverride = vi.mocked(useClearScheduleOverride)

function dateInputState(input: HTMLInputElement) {
  return { type: input.type, value: input.value }
}

function setupMocks() {
  const createMutate = vi.fn()
  const updateMutate = vi.fn()
  const deleteMutate = vi.fn()
  const setOverrideMutate = vi.fn()
  const clearOverrideMutate = vi.fn()

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
  mockUseSetScheduleOverride.mockReturnValue(
    partialMutation<ReturnType<typeof useSetScheduleOverride>>({
      mutate: setOverrideMutate,
      isPending: false,
    }),
  )
  mockUseClearScheduleOverride.mockReturnValue(
    partialMutation<ReturnType<typeof useClearScheduleOverride>>({
      mutate: clearOverrideMutate,
      isPending: false,
    }),
  )
  mockUseScheduleDetails.mockReturnValue(
    partialMutation<ReturnType<typeof useScheduleDetails>>({
      data: {
        id: sampleSchedule.scheduleId,
        title: sampleSchedule.title,
        startDate: sampleSchedule.startDate,
        endDate: null,
        remindBeforeMinutes: null,
        startTime: '07:00',
        endTime: '08:00',
        recurrence: sampleSchedule.recurrence,
        context: 'personal',
        color: sampleSchedule.color,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      isLoading: false,
    }),
  )
  mockUseScheduleOverrides.mockReturnValue(
    partialMutation<ReturnType<typeof useScheduleOverrides>>({
      data: [],
      isLoading: false,
    }),
  )
  mockUseScheduleChangePreview.mockReturnValue(
    partialMutation<ReturnType<typeof useScheduleChangePreview>>({
      data: {
        range: { startDate: '2026-01-01', endDate: '2026-01-31' },
        changes: [],
        deletedOverrides: [],
      },
      isSuccess: true,
      isFetching: false,
    }),
  )

  return {
    createMutate,
    updateMutate,
    deleteMutate,
    setOverrideMutate,
    clearOverrideMutate,
  }
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

function normalizeNoOpSaveResult(
  overrideCalls: readonly unknown[][],
  closeCalls: readonly unknown[][],
) {
  return {
    overrideCalls,
    closeCalls,
  }
}

function normalizeDialogSaveResult(
  output:
    | { title: string; updateCalls: readonly unknown[][] }
    | {
        fields: { date: string; startTime: string; endTime: string }
        overrideCalls: readonly unknown[][]
        closeCalls: readonly unknown[][]
      }
    | { previewText: string | null; mutationCalls: readonly unknown[][] }
    | { saveDisabled: boolean; overrideCalls: readonly unknown[][] }
    | {
        previewText: string | null
        callsBeforeSave: readonly unknown[][]
        callsAfterSave: readonly unknown[][]
      },
) {
  return output
}

async function clickVisibleSave(user: ReturnType<typeof userEvent.setup>) {
  const saveButton = assertDefined(
    findVisible(screen.getAllByRole('button', { name: 'Save' })),
    'no visible save button',
  )
  await waitFor(() => {
    if (saveButton.matches(':disabled')) {
      throw new Error('Save is still disabled')
    }
  })
  await user.click(saveButton)
}

function inputValue(element: HTMLElement) {
  if (!(element instanceof HTMLInputElement)) {
    throw new Error('Expected an input element')
  }
  return element.value
}

function visibleText(text: string) {
  return findVisible(screen.queryAllByText(text))?.textContent ?? null
}

async function waitForVisibleText(text: string) {
  await waitFor(() => {
    if (visibleText(text) == null) throw new Error(`Text not visible: ${text}`)
  })
}

const sampleSchedule = makeSchedule()

describe('CreateScheduleModal', () => {
  it('loads exceptions from today onward', () => {
    setupMocks()
    renderControlledModal(CreateScheduleModal, { schedule: sampleSchedule })

    expect(mockUseScheduleOverrides.mock.calls.at(-1)).toEqual([
      sampleSchedule.scheduleId,
      true,
      formatLocalDate(new Date()),
    ])
  })

  it('shows exception dates with a weekday and month-day label', async () => {
    setupMocks()
    mockUseScheduleOverrides.mockReturnValue(
      partialMutation<ReturnType<typeof useScheduleOverrides>>({
        data: [
          makeScheduleOverride({
            occurrenceDate: '2030-04-20',
            skipped: true,
          }),
        ],
        isLoading: false,
      }),
    )
    const user = userEvent.setup()
    renderControlledModal(CreateScheduleModal, { schedule: sampleSchedule })
    await user.click(
      assertDefined(
        findVisible(screen.getAllByRole('button', { name: 'All events' })),
        'no visible all-events scope button',
      ),
    )

    await waitForVisibleText('Sat 04-20 · skipped')

    expect(visibleText('Sat 04-20 · skipped')).toEqual('Sat 04-20 · skipped')
  })

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

  it('shows the schedule title while editing one occurrence', () => {
    setupMocks()
    renderControlledModal(CreateScheduleModal, { schedule: sampleSchedule })

    expect(findVisible(screen.getAllByText('Gym'))).toBeInTheDocument()
  })

  it('closes without creating an override when the occurrence is unchanged', async () => {
    const { setOverrideMutate } = setupMocks()
    const user = userEvent.setup()
    const { onOpenChange } = renderControlledModal(CreateScheduleModal, {
      schedule: sampleSchedule,
    })

    await clickVisibleSave(user)

    expect(
      normalizeNoOpSaveResult(
        normalizeMutationCalls(setOverrideMutate.mock.calls),
        onOpenChange.mock.calls,
      ),
    ).toEqual({ overrideCalls: [], closeCalls: [[false]] })
  })

  it('hydrates refreshed all-events fields when reopening the dialog', async () => {
    const { updateMutate } = setupMocks()
    const user = userEvent.setup()
    const modal = renderControlledModal(CreateScheduleModal, {
      schedule: sampleSchedule,
    })

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    mockUseScheduleDetails.mockReturnValue(
      partialMutation<ReturnType<typeof useScheduleDetails>>({
        data: {
          id: sampleSchedule.scheduleId,
          title: 'Updated schedule title',
          startDate: sampleSchedule.startDate,
          endDate: null,
          remindBeforeMinutes: null,
          startTime: '07:00',
          endTime: '08:00',
          recurrence: sampleSchedule.recurrence,
          context: 'personal',
          color: sampleSchedule.color,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-02T00:00:00.000Z',
        },
        isLoading: false,
        isFetching: false,
      }),
    )
    modal.setOpen(true)
    await user.click(
      assertDefined(
        findVisible(screen.getAllByRole('button', { name: 'All events' })),
        'no visible all-events scope button',
      ),
    )
    fireEvent.change(
      assertDefined(
        findVisible(screen.getAllByLabelText('Remind before start')),
        'no visible reminder input',
      ),
      { target: { value: '30' } },
    )
    const title = assertDefined(
      findVisible(screen.getAllByPlaceholderText('Schedule title')),
      'no visible schedule title input',
    )
    const titleValue = inputValue(title)
    await clickVisibleSave(user)

    expect(
      normalizeDialogSaveResult({
        title: titleValue,
        updateCalls: normalizeMutationCalls(updateMutate.mock.calls),
      }),
    ).toEqual({
      title: 'Updated schedule title',
      updateCalls: [
        [
          { id: 'schedule-1', input: { remindBeforeMinutes: 30 } },
          { onSuccess: 'callback' },
        ],
      ],
    })
  })

  it.each([
    ['the start segment', '2026-01-01T23:00:00', '2026-01-02T00:00:00'],
    ['the continuation segment', '2026-01-02T00:00:00', '2026-01-02T07:00:00'],
  ] as const)(
    'loads the full cross-midnight occurrence when opened from %s',
    async (_segment, start, end) => {
      const { setOverrideMutate } = setupMocks()
      const user = userEvent.setup()
      const { onOpenChange } = renderControlledModal(CreateScheduleModal, {
        schedule: makeSchedule({
          occurrenceDate: '2026-01-01',
          occurrenceStartDate: '2026-01-01',
          occurrenceStartTime: '23:00',
          occurrenceEndTime: '07:00',
          start,
          end,
        }),
      })

      const fields = {
        date: inputValue(
          assertDefined(
            findVisible(screen.getAllByLabelText('Start date')),
            'no visible occurrence date input',
          ),
        ),
        startTime: inputValue(
          assertDefined(
            findVisible(screen.getAllByLabelText('Start time')),
            'no visible occurrence start time input',
          ),
        ),
        endTime: inputValue(
          assertDefined(
            findVisible(screen.getAllByLabelText('End time')),
            'no visible occurrence end time input',
          ),
        ),
      }
      await clickVisibleSave(user)

      expect(
        normalizeDialogSaveResult({
          fields,
          overrideCalls: normalizeMutationCalls(setOverrideMutate.mock.calls),
          closeCalls: onOpenChange.mock.calls,
        }),
      ).toEqual({
        fields: { date: '2026-01-01', startTime: '23:00', endTime: '07:00' },
        overrideCalls: [],
        closeCalls: [[false]],
      })
    },
  )

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

    await user.click(screen.getByRole('button', { name: 'Start: 2026-07-20' }))

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

    const titleInput = assertDefined(
      findVisible(screen.getAllByPlaceholderText('Schedule title')),
      'no visible schedule title input',
    )
    await user.type(titleInput, 'Team sync')

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
    await page.viewport(DESKTOP_VIEWPORT.width, DESKTOP_VIEWPORT.height)
    const { updateMutate } = setupMocks()
    const user = userEvent.setup()
    renderControlledModal(CreateScheduleModal, { schedule: sampleSchedule })

    await user.click(
      assertDefined(
        findVisible(screen.getAllByRole('button', { name: 'All events' })),
        'no visible all-events scope button',
      ),
    )

    const titleInput = assertDefined(
      findVisible(screen.getAllByPlaceholderText('Schedule title')),
      'no visible schedule title input',
    )
    await user.clear(titleInput)
    await user.type(titleInput, 'Morning run')

    await clickVisibleSave(user)

    expect(normalizeMutationCalls(updateMutate.mock.calls)).toEqual([
      [
        {
          id: 'schedule-1',
          input: { title: 'Morning run' },
        },
        { onSuccess: 'callback' },
      ],
    ])
  })

  it('sends only the schedule settings changed in the edit form', async () => {
    const { updateMutate } = setupMocks()
    const user = userEvent.setup()
    renderControlledModal(CreateScheduleModal, { schedule: sampleSchedule })

    await user.click(
      assertDefined(
        findVisible(screen.getAllByRole('button', { name: 'All events' })),
        'no visible all-events scope button',
      ),
    )

    fireEvent.change(
      assertDefined(
        findVisible(screen.getAllByLabelText('Start time')),
        'no visible schedule start time input',
      ),
      { target: { value: '07:30' } },
    )

    await clickVisibleSave(user)

    expect(normalizeMutationCalls(updateMutate.mock.calls)).toEqual([
      [
        {
          id: 'schedule-1',
          input: { startTime: '07:30' },
        },
        { onSuccess: 'callback' },
      ],
    ])
  })

  it('saves a move for only the selected occurrence', async () => {
    const { setOverrideMutate } = setupMocks()
    mockUseScheduleChangePreview.mockReturnValue(
      partialMutation<ReturnType<typeof useScheduleChangePreview>>({
        data: {
          range: { startDate: '2026-01-01', endDate: '2026-01-31' },
          changes: [
            {
              before: {
                date: '2026-01-01',
                originalDate: '2026-01-01',
                startTime: '07:00',
                endTime: '08:00',
                skipped: false,
              },
              after: {
                date: '2026-01-02',
                originalDate: '2026-01-01',
                startTime: '08:00',
                endTime: '09:00',
                skipped: false,
              },
            },
          ],
          deletedOverrides: [],
        },
        isSuccess: true,
        isFetching: false,
      }),
    )
    const user = userEvent.setup()
    renderControlledModal(CreateScheduleModal, { schedule: sampleSchedule })

    fireEvent.change(
      assertDefined(
        findVisible(screen.getAllByLabelText('Start date')),
        'no visible occurrence date input',
      ),
      { target: { value: '2026-01-02' } },
    )
    fireEvent.change(
      assertDefined(
        findVisible(screen.getAllByLabelText('Start time')),
        'no visible occurrence start time input',
      ),
      { target: { value: '08:00' } },
    )
    fireEvent.change(
      assertDefined(
        findVisible(screen.getAllByLabelText('End time')),
        'no visible occurrence end time input',
      ),
      { target: { value: '09:00' } },
    )
    const previewText =
      'Moves this event from Thu, Jan 1 to Fri, Jan 2. Other events are unchanged.'
    await waitForVisibleText(previewText)
    const visiblePreview = visibleText(previewText)
    await clickVisibleSave(user)

    expect(
      normalizeDialogSaveResult({
        previewText: visiblePreview,
        mutationCalls: normalizeMutationCalls(setOverrideMutate.mock.calls),
      }),
    ).toEqual({
      previewText,
      mutationCalls: [
        [
          {
            scheduleId: 'schedule-1',
            occurrenceDate: '2026-01-01',
            input: {
              date: '2026-01-02',
              startTime: '08:00',
              endTime: '09:00',
            },
          },
          { onSuccess: 'callback' },
        ],
      ],
    })
  })

  it('previews and saves skipping only the selected occurrence', async () => {
    const { setOverrideMutate } = setupMocks()
    const user = userEvent.setup()
    renderControlledModal(CreateScheduleModal, { schedule: sampleSchedule })

    await user.click(
      assertDefined(
        findVisible(screen.getAllByRole('button', { name: 'Skip this event' })),
        'no visible skip button',
      ),
    )
    const previewText =
      'Skips this event on Thu, Jan 1. Other events are unchanged.'
    await waitForVisibleText(previewText)
    const visiblePreview = visibleText(previewText)
    await clickVisibleSave(user)

    expect(
      normalizeDialogSaveResult({
        previewText: visiblePreview,
        mutationCalls: normalizeMutationCalls(setOverrideMutate.mock.calls),
      }),
    ).toEqual({
      previewText,
      mutationCalls: [
        [
          {
            scheduleId: 'schedule-1',
            occurrenceDate: '2026-01-01',
            input: { skipped: true },
          },
          { onSuccess: 'callback' },
        ],
      ],
    })
  })

  it('keeps Save disabled when the occurrence preview fails', async () => {
    const { setOverrideMutate } = setupMocks()
    mockUseScheduleChangePreview.mockReturnValue(
      partialMutation<ReturnType<typeof useScheduleChangePreview>>({
        data: undefined,
        isSuccess: false,
        isError: true,
        isFetching: false,
      }),
    )
    const user = userEvent.setup()
    renderControlledModal(CreateScheduleModal, { schedule: sampleSchedule })

    await user.click(
      assertDefined(
        findVisible(screen.getAllByRole('button', { name: 'Skip this event' })),
        'no visible skip button',
      ),
    )
    await waitForVisibleText(
      'Could not load the preview. Try again after editing.',
    )
    const saveButton = assertDefined(
      findVisible(screen.getAllByRole('button', { name: 'Save' })),
      'no visible save button',
    )

    expect(
      normalizeDialogSaveResult({
        saveDisabled: saveButton.matches(':disabled'),
        overrideCalls: normalizeMutationCalls(setOverrideMutate.mock.calls),
      }),
    ).toEqual({ saveDisabled: true, overrideCalls: [] })
  })

  it('restores the selected occurrence when the restore action is saved', async () => {
    const { clearOverrideMutate } = setupMocks()
    const user = userEvent.setup()
    renderControlledModal(CreateScheduleModal, {
      schedule: makeSchedule({ overridden: 'time' }),
    })

    await user.click(
      assertDefined(
        findVisible(screen.getAllByRole('button', { name: 'Restore' })),
        'no visible restore button',
      ),
    )
    const previewText =
      'Restores this event on Thu, Jan 1 to its scheduled date and time.'
    await waitForVisibleText(previewText)
    const visiblePreview = visibleText(previewText)
    await clickVisibleSave(user)

    expect(
      normalizeDialogSaveResult({
        previewText: visiblePreview,
        mutationCalls: normalizeMutationCalls(clearOverrideMutate.mock.calls),
      }),
    ).toEqual({
      previewText,
      mutationCalls: [
        [
          { scheduleId: 'schedule-1', occurrenceDate: '2026-01-01' },
          { onSuccess: 'callback' },
        ],
      ],
    })
  })

  it('applies time changes from the selected occurrence forward', async () => {
    const { updateMutate } = setupMocks()
    const user = userEvent.setup()
    renderControlledModal(CreateScheduleModal, { schedule: sampleSchedule })

    await user.click(
      assertDefined(
        findVisible(
          screen.getAllByRole('button', { name: 'This and following' }),
        ),
        'no visible following-events scope button',
      ),
    )
    fireEvent.change(
      assertDefined(
        findVisible(screen.getAllByLabelText('Start time')),
        'no visible start time input',
      ),
      { target: { value: '07:30' } },
    )
    await clickVisibleSave(user)

    expect(normalizeMutationCalls(updateMutate.mock.calls)).toEqual([
      [
        {
          id: 'schedule-1',
          input: { effectiveFrom: '2026-01-01', startTime: '07:30' },
        },
        { onSuccess: 'callback' },
      ],
    ])
  })

  it('ends the series before the selected date', async () => {
    const { updateMutate } = setupMocks()
    const user = userEvent.setup()
    renderControlledModal(CreateScheduleModal, {
      schedule: makeSchedule({
        occurrenceDate: '2026-01-03',
        start: '2026-01-03T07:00:00',
        end: '2026-01-03T08:00:00',
      }),
    })

    await user.click(
      assertDefined(
        findVisible(
          screen.getAllByRole('button', { name: 'This and following' }),
        ),
        'no visible following-events scope button',
      ),
    )
    await user.click(
      assertDefined(
        findVisible(screen.getAllByRole('button', { name: 'End series here' })),
        'no visible end-series button',
      ),
    )
    await clickVisibleSave(user)

    expect(normalizeMutationCalls(updateMutate.mock.calls)).toEqual([
      [
        { id: 'schedule-1', input: { endDate: '2026-01-02' } },
        { onSuccess: 'callback' },
      ],
    ])
  })

  it('sets a reminder for all occurrences', async () => {
    const { updateMutate } = setupMocks()
    const user = userEvent.setup()
    renderControlledModal(CreateScheduleModal, { schedule: sampleSchedule })

    await user.click(
      assertDefined(
        findVisible(screen.getAllByRole('button', { name: 'All events' })),
        'no visible all-events scope button',
      ),
    )
    fireEvent.change(
      assertDefined(
        findVisible(screen.getAllByLabelText('Remind before start')),
        'no visible reminder input',
      ),
      { target: { value: '30' } },
    )
    await clickVisibleSave(user)

    expect(normalizeMutationCalls(updateMutate.mock.calls)).toEqual([
      [
        { id: 'schedule-1', input: { remindBeforeMinutes: 30 } },
        { onSuccess: 'callback' },
      ],
    ])
  })

  it('compares all-events changes with the first revision values', async () => {
    const { updateMutate } = setupMocks()
    const user = userEvent.setup()
    const laterRevisionSchedule = makeSchedule({
      start: '2026-01-01T09:00:00',
      end: '2026-01-01T10:00:00',
      recurrence: {
        id: 'later-rule',
        type: 'daily',
        interval: 1,
        daysOfWeek: null,
        dayOfMonth: null,
      },
    })
    renderControlledModal(CreateScheduleModal, {
      schedule: laterRevisionSchedule,
    })

    await user.click(
      assertDefined(
        findVisible(screen.getAllByRole('button', { name: 'All events' })),
        'no visible all-events scope button',
      ),
    )
    fireEvent.change(
      assertDefined(
        findVisible(screen.getAllByLabelText('Remind before start')),
        'no visible reminder input',
      ),
      { target: { value: '30' } },
    )
    await clickVisibleSave(user)

    expect(normalizeMutationCalls(updateMutate.mock.calls)).toEqual([
      [
        { id: 'schedule-1', input: { remindBeforeMinutes: 30 } },
        { onSuccess: 'callback' },
      ],
    ])
  })

  it('restores an exception from the all-events list', async () => {
    const { clearOverrideMutate } = setupMocks()
    mockUseScheduleOverrides.mockReturnValue(
      partialMutation<ReturnType<typeof useScheduleOverrides>>({
        data: [
          makeScheduleOverride({
            occurrenceDate: '2026-01-03',
            skipped: true,
          }),
        ],
        isLoading: false,
      }),
    )
    const user = userEvent.setup()
    renderControlledModal(CreateScheduleModal, { schedule: sampleSchedule })

    await user.click(
      assertDefined(
        findVisible(screen.getAllByRole('button', { name: 'All events' })),
        'no visible all-events scope button',
      ),
    )
    await user.click(
      assertDefined(
        findVisible(screen.getAllByRole('button', { name: 'Restore' })),
        'no visible exception restore button',
      ),
    )
    const previewText =
      'Restores this event on Sat, Jan 3 to its scheduled date and time.'
    await waitForVisibleText(previewText)
    const visiblePreview = visibleText(previewText)
    const callsBeforeSave = normalizeMutationCalls(
      clearOverrideMutate.mock.calls,
    )
    await clickVisibleSave(user)

    expect(
      normalizeDialogSaveResult({
        previewText: visiblePreview,
        callsBeforeSave,
        callsAfterSave: normalizeMutationCalls(clearOverrideMutate.mock.calls),
      }),
    ).toEqual({
      previewText,
      callsBeforeSave: [],
      callsAfterSave: [
        [
          { scheduleId: 'schedule-1', occurrenceDate: '2026-01-03' },
          { onSuccess: 'callback' },
        ],
      ],
    })
  })

  it('deletes the schedule when the delete button is confirmed', async () => {
    const { deleteMutate } = setupMocks()
    const user = userEvent.setup()
    renderControlledModal(CreateScheduleModal, { schedule: sampleSchedule })

    await user.click(
      assertDefined(
        findVisible(screen.getAllByRole('button', { name: 'All events' })),
        'no visible all-events scope button',
      ),
    )

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
