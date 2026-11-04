import { describe, expect, it } from 'vitest'

import { replaceOccurrenceDateInTitle } from '#services/recurring-task-templates'

describe('replaceOccurrenceDateInTitle', () => {
  it('replaces next-week weekday placeholders with dates in the Monday-start week after the occurrence', () => {
    expect(
      replaceOccurrenceDateInTitle(
        'Prep {next-mon}..{next-fri} (made {date}, ends {next-sun})',
        '2031-04-07',
      ),
    ).toBe('Prep 2031-04-14..2031-04-18 (made 2031-04-07, ends 2031-04-20)')
  })

  it('treats a Sunday occurrence as the last day of its week', () => {
    expect(replaceOccurrenceDateInTitle('Prep {next-mon}', '2031-04-13')).toBe(
      'Prep 2031-04-14',
    )
  })
})
