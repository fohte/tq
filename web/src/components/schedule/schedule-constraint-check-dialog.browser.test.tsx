import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CreateScheduleModal } from '#components/schedule/create-schedule-modal'
import {
  makeSchedule,
  makeScheduleConstraint,
  makeScheduleDetails,
} from '#components/schedule/schedule-test-fixtures'
import {
  useClearScheduleOverride,
  useCreateSchedule,
  useDeleteSchedule,
  useDeleteScheduleConstraints,
  useScheduleChangePreview,
  useScheduleConstraintCheck,
  useScheduleConstraints,
  useScheduleDetails,
  useScheduleOverrides,
  useSetScheduleConstraints,
  useSetScheduleOverride,
  useUpdateSchedule,
} from '#hooks/use-schedules'
import { getLocalWeekDateRange } from '#lib/date-range'
import { renderControlledModal } from '#lib/render-controlled-modal'
import { assertDefined, findVisible, partialMutation } from '#lib/test-utils'

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
    useScheduleConstraintCheck: vi.fn(),
    useScheduleConstraints: vi.fn(),
    useSetScheduleOverride: vi.fn(),
    useSetScheduleConstraints: vi.fn(),
    useDeleteScheduleConstraints: vi.fn(),
    useClearScheduleOverride: vi.fn(),
  }
})

const mockUseCreateSchedule = vi.mocked(useCreateSchedule)
const mockUseUpdateSchedule = vi.mocked(useUpdateSchedule)
const mockUseDeleteSchedule = vi.mocked(useDeleteSchedule)
const mockUseScheduleDetails = vi.mocked(useScheduleDetails)
const mockUseScheduleOverrides = vi.mocked(useScheduleOverrides)
const mockUseScheduleChangePreview = vi.mocked(useScheduleChangePreview)
const mockUseScheduleConstraintCheck = vi.mocked(useScheduleConstraintCheck)
const mockUseScheduleConstraints = vi.mocked(useScheduleConstraints)
const mockUseSetScheduleOverride = vi.mocked(useSetScheduleOverride)
const mockUseClearScheduleOverride = vi.mocked(useClearScheduleOverride)
const mockUseSetScheduleConstraints = vi.mocked(useSetScheduleConstraints)
const mockUseDeleteScheduleConstraints = vi.mocked(useDeleteScheduleConstraints)

const sampleSchedule = makeSchedule()

function setupMocks() {
  mockUseCreateSchedule.mockReturnValue(
    partialMutation<ReturnType<typeof useCreateSchedule>>({
      mutate: vi.fn(),
      isPending: false,
    }),
  )
  mockUseUpdateSchedule.mockReturnValue(
    partialMutation<ReturnType<typeof useUpdateSchedule>>({
      mutate: vi.fn(),
      isPending: false,
    }),
  )
  mockUseDeleteSchedule.mockReturnValue(
    partialMutation<ReturnType<typeof useDeleteSchedule>>({
      mutate: vi.fn(),
      isPending: false,
    }),
  )
  mockUseSetScheduleOverride.mockReturnValue(
    partialMutation<ReturnType<typeof useSetScheduleOverride>>({
      mutate: vi.fn(),
      isPending: false,
    }),
  )
  mockUseClearScheduleOverride.mockReturnValue(
    partialMutation<ReturnType<typeof useClearScheduleOverride>>({
      mutate: vi.fn(),
      isPending: false,
    }),
  )
  mockUseSetScheduleConstraints.mockReturnValue(
    partialMutation<ReturnType<typeof useSetScheduleConstraints>>({
      mutate: vi.fn(),
      isPending: false,
    }),
  )
  mockUseDeleteScheduleConstraints.mockReturnValue(
    partialMutation<ReturnType<typeof useDeleteScheduleConstraints>>({
      mutate: vi.fn(),
      isPending: false,
    }),
  )
  mockUseScheduleDetails.mockReturnValue(
    partialMutation<ReturnType<typeof useScheduleDetails>>({
      data: makeScheduleDetails(),
      isFetching: false,
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
  mockUseScheduleConstraintCheck.mockReturnValue(
    partialMutation<ReturnType<typeof useScheduleConstraintCheck>>({
      data: { constraintViolations: [] },
      isLoading: false,
      isPending: false,
      isError: false,
    }),
  )
  mockUseScheduleConstraints.mockReturnValue(
    partialMutation<ReturnType<typeof useScheduleConstraints>>({
      data: { constraint: makeScheduleConstraint() },
      isLoading: false,
      isFetching: false,
    }),
  )
}

function activePreviewCall() {
  const call = mockUseScheduleChangePreview.mock.calls
    .filter(([, request, enabled]) => request != null && enabled === true)
    .at(-1)
  return call
    ? { scheduleId: call[0], request: call[1], enabled: call[2] }
    : null
}

function activeConstraintCheckCall() {
  const call = mockUseScheduleConstraintCheck.mock.calls
    .filter(([, , enabled]) => enabled === true)
    .at(-1)
  return call ? { scheduleId: call[0], input: call[1], enabled: call[2] } : null
}

async function waitForActiveRequests(
  expectedConstraintInput: unknown,
  { requirePreview = true }: { requirePreview?: boolean } = {},
) {
  await waitFor(() => {
    const check = activeConstraintCheckCall()
    if (
      JSON.stringify(check?.input) !== JSON.stringify(expectedConstraintInput)
    ) {
      throw new Error('Constraint check request has not settled')
    }
    if (requirePreview && activePreviewCall() == null) {
      throw new Error('Schedule preview request has not settled')
    }
    if (!requirePreview && activePreviewCall() != null) {
      throw new Error('Unexpected schedule preview request')
    }
  })

  return {
    preview: activePreviewCall(),
    constraintCheck: activeConstraintCheckCall(),
  }
}

function checkInput(draft: object) {
  return { ...getLocalWeekDateRange(new Date('2026-01-01T00:00:00')), draft }
}

function visibleInput(label: string) {
  return assertDefined(
    findVisible(screen.getAllByLabelText(label)),
    `no visible ${label} input`,
  )
}

async function selectScope(
  user: ReturnType<typeof userEvent.setup>,
  name: 'This and following' | 'All events',
) {
  await user.click(
    assertDefined(
      findVisible(screen.getAllByRole('button', { name })),
      `no visible ${name} button`,
    ),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  setupMocks()
})

describe('CreateScheduleModal constraint check draft', () => {
  it('uses the one-occurrence preview request for a date and time change', async () => {
    renderControlledModal(CreateScheduleModal, { schedule: sampleSchedule })

    fireEvent.change(visibleInput('Start date'), {
      target: { value: '2026-01-02' },
    })
    fireEvent.change(visibleInput('Start time'), {
      target: { value: '08:00' },
    })
    fireEvent.change(visibleInput('End time'), {
      target: { value: '09:00' },
    })

    const requests = await waitForActiveRequests(
      checkInput({
        occurrenceChange: {
          originalDate: '2026-01-01',
          date: '2026-01-02',
          startTime: '08:00',
          endTime: '09:00',
        },
      }),
    )

    expect(requests).toEqual({
      preview: {
        scheduleId: sampleSchedule.scheduleId,
        request: {
          kind: 'override',
          occurrenceDate: '2026-01-01',
          input: {
            date: '2026-01-02',
            startTime: '08:00',
            endTime: '09:00',
          },
        },
        enabled: true,
      },
      constraintCheck: {
        scheduleId: sampleSchedule.scheduleId,
        input: checkInput({
          occurrenceChange: {
            originalDate: '2026-01-01',
            date: '2026-01-02',
            startTime: '08:00',
            endTime: '09:00',
          },
        }),
        enabled: true,
      },
    })
  })

  it('uses the one-occurrence preview request when skipping an event', async () => {
    const user = userEvent.setup()
    renderControlledModal(CreateScheduleModal, { schedule: sampleSchedule })

    await user.click(
      assertDefined(
        findVisible(screen.getAllByRole('button', { name: 'Skip this event' })),
        'no visible skip button',
      ),
    )

    const requests = await waitForActiveRequests(
      checkInput({
        occurrenceChange: { originalDate: '2026-01-01', skipped: true },
      }),
    )

    expect(requests).toEqual({
      preview: {
        scheduleId: sampleSchedule.scheduleId,
        request: {
          kind: 'override',
          occurrenceDate: '2026-01-01',
          input: { skipped: true },
        },
        enabled: true,
      },
      constraintCheck: {
        scheduleId: sampleSchedule.scheduleId,
        input: checkInput({
          occurrenceChange: {
            originalDate: '2026-01-01',
            skipped: true,
          },
        }),
        enabled: true,
      },
    })
  })

  it('uses the following preview request for a time change', async () => {
    const user = userEvent.setup()
    renderControlledModal(CreateScheduleModal, { schedule: sampleSchedule })
    await selectScope(user, 'This and following')
    fireEvent.change(visibleInput('Start time'), {
      target: { value: '07:30' },
    })

    const requests = await waitForActiveRequests(
      checkInput({
        revisionChange: {
          effectiveFrom: '2026-01-01',
          startTime: '07:30',
        },
        revisionMode: 'from',
      }),
    )

    expect(requests).toEqual({
      preview: {
        scheduleId: sampleSchedule.scheduleId,
        request: {
          kind: 'update',
          input: { effectiveFrom: '2026-01-01', startTime: '07:30' },
        },
        enabled: true,
      },
      constraintCheck: {
        scheduleId: sampleSchedule.scheduleId,
        input: checkInput({
          revisionChange: {
            effectiveFrom: '2026-01-01',
            startTime: '07:30',
          },
          revisionMode: 'from',
        }),
        enabled: true,
      },
    })
  })

  it('uses the following preview request when changing recurrence', async () => {
    const user = userEvent.setup()
    renderControlledModal(CreateScheduleModal, { schedule: sampleSchedule })
    await selectScope(user, 'This and following')
    await user.click(
      assertDefined(
        findVisible(screen.getAllByRole('combobox')),
        'no visible recurrence selector',
      ),
    )
    await user.click(await screen.findByRole('option', { name: 'Daily' }))

    const recurrence = { type: 'daily', interval: 1 }
    const requests = await waitForActiveRequests(
      checkInput({
        revisionChange: { effectiveFrom: '2026-01-01', recurrence },
        revisionMode: 'from',
      }),
    )

    expect(requests).toEqual({
      preview: {
        scheduleId: sampleSchedule.scheduleId,
        request: {
          kind: 'update',
          input: { effectiveFrom: '2026-01-01', recurrence },
        },
        enabled: true,
      },
      constraintCheck: {
        scheduleId: sampleSchedule.scheduleId,
        input: checkInput({
          revisionChange: { effectiveFrom: '2026-01-01', recurrence },
          revisionMode: 'from',
        }),
        enabled: true,
      },
    })
  })

  it('checks the end date when ending the series removes it', async () => {
    const user = userEvent.setup()
    renderControlledModal(CreateScheduleModal, { schedule: sampleSchedule })
    await selectScope(user, 'This and following')
    await user.click(
      assertDefined(
        findVisible(screen.getAllByRole('button', { name: 'End series here' })),
        'no visible end-series button',
      ),
    )

    const requests = await waitForActiveRequests(
      checkInput({ endDate: '2025-12-31' }),
      { requirePreview: false },
    )
    expect(requests).toEqual({
      preview: null,
      constraintCheck: {
        scheduleId: sampleSchedule.scheduleId,
        input: checkInput({ endDate: '2025-12-31' }),
        enabled: true,
      },
    })
  })

  it('uses the end-series preview request for the constraint check', async () => {
    const user = userEvent.setup()
    renderControlledModal(CreateScheduleModal, { schedule: sampleSchedule })
    await selectScope(user, 'This and following')
    fireEvent.change(visibleInput('Start date'), {
      target: { value: '2026-01-03' },
    })
    await user.click(
      assertDefined(
        findVisible(screen.getAllByRole('button', { name: 'End series here' })),
        'no visible end-series button',
      ),
    )

    const requests = await waitForActiveRequests(
      checkInput({ endDate: '2026-01-02' }),
    )

    expect(requests).toEqual({
      preview: {
        scheduleId: sampleSchedule.scheduleId,
        request: { kind: 'update', input: { endDate: '2026-01-02' } },
        enabled: true,
      },
      constraintCheck: {
        scheduleId: sampleSchedule.scheduleId,
        input: checkInput({ endDate: '2026-01-02' }),
        enabled: true,
      },
    })
  })

  it('uses all-events preview changes for the constraint check', async () => {
    const user = userEvent.setup()
    renderControlledModal(CreateScheduleModal, { schedule: sampleSchedule })
    await selectScope(user, 'All events')
    fireEvent.change(visibleInput('Start time'), {
      target: { value: '07:30' },
    })

    const requests = await waitForActiveRequests(
      checkInput({
        revisionChange: {
          effectiveFrom: '2026-01-01',
          startTime: '07:30',
        },
        revisionMode: 'all',
      }),
    )

    expect(requests).toEqual({
      preview: {
        scheduleId: sampleSchedule.scheduleId,
        request: { kind: 'update', input: { startTime: '07:30' } },
        enabled: true,
      },
      constraintCheck: {
        scheduleId: sampleSchedule.scheduleId,
        input: checkInput({
          revisionChange: {
            effectiveFrom: '2026-01-01',
            startTime: '07:30',
          },
          revisionMode: 'all',
        }),
        enabled: true,
      },
    })
  })

  it('uses replace mode for an all-events start-date change', async () => {
    const user = userEvent.setup()
    renderControlledModal(CreateScheduleModal, { schedule: sampleSchedule })
    await selectScope(user, 'All events')
    fireEvent.change(visibleInput('Start date'), {
      target: { value: '2026-01-02' },
    })

    const requests = await waitForActiveRequests(
      checkInput({
        revisionChange: { effectiveFrom: '2026-01-02' },
        revisionMode: 'replace',
      }),
    )

    expect(requests).toEqual({
      preview: {
        scheduleId: sampleSchedule.scheduleId,
        request: { kind: 'update', input: { startDate: '2026-01-02' } },
        enabled: true,
      },
      constraintCheck: {
        scheduleId: sampleSchedule.scheduleId,
        input: checkInput({
          revisionChange: { effectiveFrom: '2026-01-02' },
          revisionMode: 'replace',
        }),
        enabled: true,
      },
    })
  })

  it('combines edited constraints with the all-events preview request', async () => {
    const user = userEvent.setup()
    renderControlledModal(CreateScheduleModal, { schedule: sampleSchedule })
    await selectScope(user, 'All events')
    fireEvent.change(visibleInput('Start time'), {
      target: { value: '07:30' },
    })
    fireEvent.change(visibleInput('Minimum per week'), {
      target: { value: '2' },
    })

    const requests = await waitForActiveRequests(
      checkInput({
        constraints: {
          weeklyMin: 2,
          weeklyMax: 4,
          weeklyTarget: 4,
          maxConsecutiveDays: 2,
          windowStart: null,
          windowEnd: null,
          weekdays: [
            { dayOfWeek: 2, preference: 'if_free' },
            { dayOfWeek: 5, preference: 'excluded' },
          ],
        },
        revisionChange: {
          effectiveFrom: '2026-01-01',
          startTime: '07:30',
        },
        revisionMode: 'all',
      }),
    )

    expect(requests).toEqual({
      preview: {
        scheduleId: sampleSchedule.scheduleId,
        request: { kind: 'update', input: { startTime: '07:30' } },
        enabled: true,
      },
      constraintCheck: {
        scheduleId: sampleSchedule.scheduleId,
        input: checkInput({
          constraints: {
            weeklyMin: 2,
            weeklyMax: 4,
            weeklyTarget: 4,
            maxConsecutiveDays: 2,
            windowStart: null,
            windowEnd: null,
            weekdays: [
              { dayOfWeek: 2, preference: 'if_free' },
              { dayOfWeek: 5, preference: 'excluded' },
            ],
          },
          revisionChange: {
            effectiveFrom: '2026-01-01',
            startTime: '07:30',
          },
          revisionMode: 'all',
        }),
        enabled: true,
      },
    })
  })
})
