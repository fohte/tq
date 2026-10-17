import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ScheduleConstraintCheckResult } from '#components/schedule/schedule-constraint-check-result'
import { makeScheduleConstraintViolations } from '#components/schedule/schedule-test-fixtures'

function normalizedText(element: Element | null): string {
  return element?.textContent.replace(/\s+/g, ' ').trim() ?? ''
}

function violationResultOutcome(container: HTMLElement) {
  return {
    heading: normalizedText(container.querySelector('h3')),
    rows: Array.from(container.querySelectorAll('[role="listitem"]')).map(
      normalizedText,
    ),
  }
}

function allConstraintsMetOutcome(container: HTMLElement) {
  return {
    heading: normalizedText(container.querySelector('h3')),
    result: normalizedText(container.querySelector('[role="status"]')),
  }
}

describe('ScheduleConstraintCheckResult', () => {
  it('formats every constraint violation with its severity', () => {
    const { container } = render(
      <ScheduleConstraintCheckResult
        occurrenceDate="2041-05-15"
        constraintViolations={makeScheduleConstraintViolations()}
        isLoading={false}
        isError={false}
        isIncomplete={false}
        draftInvalid={false}
      />,
    )

    expect(violationResultOutcome(container)).toEqual({
      heading: 'This week · May 13 – 19',
      rows: [
        '2 of min 5 this week REQUIRED',
        '6 of max 5 this week REQUIRED',
        '4 of target 6 this week PREFERRED',
        'Thu is set to Never (moved from Wed) REQUIRED',
        'Uses backup day: Fri PREFERRED',
        '3 days in a row: Tue, Wed, Thu REQUIRED',
        '06:30–07:30 is outside 07:00–08:00 REQUIRED',
        'Fri overlaps another event (07:00–07:30) REQUIRED',
      ],
    })
  })

  it('shows a green result when every constraint is met', () => {
    const { container } = render(
      <ScheduleConstraintCheckResult
        occurrenceDate="2041-05-15"
        constraintViolations={[]}
        isLoading={false}
        isError={false}
        isIncomplete={false}
        draftInvalid={false}
      />,
    )

    expect(allConstraintsMetOutcome(container)).toEqual({
      heading: 'This week · May 13 – 19',
      result: 'All constraints met',
    })
  })
})
