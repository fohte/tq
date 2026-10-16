import { captureWithFingerprint } from '@fohte/service-kit/observability'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { deliverDueReminders } from '#services/reminder-delivery'
import { deliverDueScheduleReminders } from '#services/schedule-reminder-delivery'
import { startReminderScheduler } from '#services/task-reminders'

vi.mock('@fohte/service-kit/observability', () => ({
  captureWithFingerprint: vi.fn(),
}))

vi.mock('#services/reminder-delivery', () => ({
  deliverDueReminders: vi.fn(),
}))

vi.mock('#services/schedule-reminder-delivery', () => ({
  deliverDueScheduleReminders: vi.fn(),
}))

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

function capturedErrors() {
  return vi
    .mocked(captureWithFingerprint)
    .mock.calls.map(([error, fingerprint]) => ({
      message: error instanceof Error ? error.message : String(error),
      fingerprint,
    }))
}

async function runOneTick() {
  vi.useFakeTimers()
  const timer = startReminderScheduler()
  await vi.advanceTimersByTimeAsync(30_000)
  clearInterval(timer)
  await Promise.resolve()
  await Promise.resolve()
}

describe('startReminderScheduler', () => {
  it('captures task delivery failures with the task reminder fingerprint', async () => {
    vi.mocked(deliverDueReminders).mockRejectedValue(new Error('task failed'))
    vi.mocked(deliverDueScheduleReminders).mockResolvedValue(undefined)

    await runOneTick()

    expect(capturedErrors()).toEqual([
      {
        message: 'task failed',
        fingerprint: 'api.reminders.tick-failed',
      },
    ])
  })

  it('captures schedule delivery failures with the schedule reminder fingerprint', async () => {
    vi.mocked(deliverDueReminders).mockResolvedValue(undefined)
    vi.mocked(deliverDueScheduleReminders).mockRejectedValue(
      new Error('schedule failed'),
    )

    await runOneTick()

    expect(capturedErrors()).toEqual([
      {
        message: 'schedule failed',
        fingerprint: 'api.schedule-reminders.tick-failed',
      },
    ])
  })
})
