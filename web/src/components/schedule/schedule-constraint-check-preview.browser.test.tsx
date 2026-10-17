import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ScheduleConstraintCheckPreview } from '#components/schedule/schedule-constraint-check-preview'
import { makeScheduleConstraint } from '#components/schedule/schedule-test-fixtures'
import { useScheduleConstraintCheck } from '#hooks/use-schedules'
import { partialMutation } from '#lib/test-utils'

vi.mock('#hooks/use-schedules', () => ({
  useScheduleConstraintCheck: vi.fn(),
}))

const mockUseScheduleConstraintCheck = vi.mocked(useScheduleConstraintCheck)

function enabledRequests() {
  return mockUseScheduleConstraintCheck.mock.calls
    .filter(([, , enabled]) => enabled === true)
    .map(([scheduleId, input]) => ({ scheduleId, input }))
}

function requestTimingOutcome(
  beforeSettle: ReturnType<typeof enabledRequests>,
  afterSettle: ReturnType<typeof enabledRequests>,
) {
  return { beforeSettle, afterSettle }
}

describe('ScheduleConstraintCheckPreview', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockUseScheduleConstraintCheck.mockReturnValue(
      partialMutation<ReturnType<typeof useScheduleConstraintCheck>>({
        data: undefined,
        isFetching: false,
        isError: false,
      }),
    )
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.resetAllMocks()
  })

  it('checks only the latest draft after edits settle', () => {
    const range = { startDate: '2041-05-13', endDate: '2041-05-19' }
    const { rerender } = render(
      <ScheduleConstraintCheckPreview
        scheduleId="schedule-1"
        range={range}
        draft={{ constraints: makeScheduleConstraint({ weeklyTarget: 3 }) }}
        enabled={false}
        draftInvalid={false}
      />,
    )

    mockUseScheduleConstraintCheck.mockClear()
    rerender(
      <ScheduleConstraintCheckPreview
        scheduleId="schedule-1"
        range={range}
        draft={{ constraints: makeScheduleConstraint({ weeklyTarget: 4 }) }}
        enabled
        draftInvalid={false}
      />,
    )
    const beforeSettle = enabledRequests()

    act(() => {
      vi.advanceTimersByTime(100)
    })
    rerender(
      <ScheduleConstraintCheckPreview
        scheduleId="schedule-1"
        range={range}
        draft={{ constraints: makeScheduleConstraint({ weeklyTarget: 5 }) }}
        enabled
        draftInvalid={false}
      />,
    )
    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(requestTimingOutcome(beforeSettle, enabledRequests())).toEqual({
      beforeSettle: [],
      afterSettle: [
        {
          scheduleId: 'schedule-1',
          input: {
            ...range,
            draft: {
              constraints: makeScheduleConstraint({ weeklyTarget: 5 }),
            },
          },
        },
      ],
    })
  })
})
