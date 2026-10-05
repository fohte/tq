import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { makeTimeBlockEvent } from '#components/calendar/time-block-event-test-fixtures'
import { NowPanel } from '#components/day-view/now-panel'
import { buildNowPanelModel } from '#components/day-view/now-panel-model'

const now = new Date(2031, 3, 9, 14, 52)

function localTime(day: number, hour: number, minute = 0): string {
  return `2031-04-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`
}

function getObservedJoinState(openedUrls: unknown[][]) {
  return {
    buttonLabels: screen
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label')),
    openedUrls,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('NowPanel', () => {
  it('opens the active and next meeting URLs and hides Join for events without a visible URL', async () => {
    const user = userEvent.setup()
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const currentMeeting = makeTimeBlockEvent({
      id: 'meeting-current',
      title: 'Product review',
      start: localTime(9, 14),
      end: localTime(9, 15),
      type: 'gcal-meeting',
      meetingUrl: 'https://meet.example.com/current-room',
    })
    const nextMeeting = makeTimeBlockEvent({
      id: 'meeting-next',
      title: 'Planning call',
      start: localTime(9, 15),
      end: localTime(9, 15, 30),
      type: 'gcal-meeting',
      meetingUrl: 'https://meet.example.com/next-room',
    })
    const unlinkedMeeting = makeTimeBlockEvent({
      id: 'meeting-unlinked',
      title: 'Room check',
      start: localTime(9, 14),
      end: localTime(9, 14, 30),
      type: 'gcal-meeting',
    })
    const hiddenMeeting = makeTimeBlockEvent({
      id: 'meeting-hidden',
      title: 'Private appointment',
      start: localTime(9, 14),
      end: localTime(9, 14, 30),
      type: 'gcal-meeting',
      redacted: true,
    })
    const model = buildNowPanelModel({
      now,
      timeBlocks: [],
      calendarEvents: [
        currentMeeting,
        nextMeeting,
        unlinkedMeeting,
        hiddenMeeting,
      ],
      tasks: new Map(),
    })

    render(<NowPanel model={model} />)

    await user.click(
      screen.getByRole('button', { name: 'Join Product review' }),
    )
    await user.click(screen.getByRole('button', { name: 'Join Planning call' }))

    expect(getObservedJoinState(open.mock.calls)).toEqual({
      buttonLabels: ['Join Product review', 'Join Planning call'],
      openedUrls: [
        [
          'https://meet.example.com/current-room',
          '_blank',
          'noopener,noreferrer',
        ],
        ['https://meet.example.com/next-room', '_blank', 'noopener,noreferrer'],
      ],
    })
  })
})
