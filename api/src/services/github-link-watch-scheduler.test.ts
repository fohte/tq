import { afterEach, describe, expect, it, vi } from 'vitest'

import { startGithubLinkWatchScheduler } from '#services/github-link-watch-scheduler'
import { syncAllGithubLinks } from '#services/github-sync'

vi.mock('#services/github-sync', () => ({
  syncAllGithubLinks: vi.fn(),
}))

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('startGithubLinkWatchScheduler', () => {
  it('runs a full GitHub sync every 60 seconds', async () => {
    vi.useFakeTimers()
    vi.mocked(syncAllGithubLinks).mockResolvedValue(undefined)
    const timer = startGithubLinkWatchScheduler()

    await vi.advanceTimersByTimeAsync(59_999)
    const callsBeforeInterval = vi.mocked(syncAllGithubLinks).mock.calls.length
    await vi.advanceTimersByTimeAsync(1)
    const callsAtFirstInterval = [...vi.mocked(syncAllGithubLinks).mock.calls]
    await vi.advanceTimersByTimeAsync(60_000)
    const callsAtSecondInterval = [...vi.mocked(syncAllGithubLinks).mock.calls]
    clearInterval(timer)

    const snapshot = () => ({
      callsBeforeInterval,
      callsAtFirstInterval,
      callsAtSecondInterval,
    })
    expect(snapshot()).toEqual({
      callsBeforeInterval: 0,
      callsAtFirstInterval: [[]],
      callsAtSecondInterval: [[], []],
    })
  })
})
