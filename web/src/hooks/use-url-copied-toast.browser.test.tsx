import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { UrlCopiedToast } from '#components/layout/url-copied-toast'
import { useUrlCopiedToast } from '#hooks/use-url-copied-toast'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

function UrlCopiedToastHarness() {
  const url = useUrlCopiedToast()
  return <UrlCopiedToast url={url} />
}

function readAnnouncement(): string | null {
  return screen.queryByRole('status')?.textContent ?? null
}

describe('useUrlCopiedToast', () => {
  it('shows the copied URL and hides it after 1.5 seconds', () => {
    const url = 'https://example.test/tasks/42'
    render(<UrlCopiedToastHarness />)
    const announcements: (string | null)[] = []

    act(() => {
      window.dispatchEvent(
        new CustomEvent('tq:url-copied', { detail: { url } }),
      )
    })
    announcements.push(readAnnouncement())

    act(() => {
      vi.advanceTimersByTime(1499)
    })
    announcements.push(readAnnouncement())

    act(() => {
      vi.advanceTimersByTime(1)
    })
    announcements.push(readAnnouncement())

    expect(announcements).toEqual([
      `URL copied${url}`,
      `URL copied${url}`,
      null,
    ])
  })

  it('restarts the timeout when another URL is copied', () => {
    const firstUrl = 'https://example.test/tasks/42'
    const secondUrl = 'https://example.test/tasks/43'
    render(<UrlCopiedToastHarness />)
    const announcements: (string | null)[] = []

    act(() => {
      window.dispatchEvent(
        new CustomEvent('tq:url-copied', { detail: { url: firstUrl } }),
      )
    })
    announcements.push(readAnnouncement())

    act(() => {
      vi.advanceTimersByTime(1000)
      window.dispatchEvent(
        new CustomEvent('tq:url-copied', { detail: { url: secondUrl } }),
      )
    })
    announcements.push(readAnnouncement())

    act(() => {
      vi.advanceTimersByTime(1499)
    })
    announcements.push(readAnnouncement())

    act(() => {
      vi.advanceTimersByTime(1)
    })
    announcements.push(readAnnouncement())

    expect(announcements).toEqual([
      `URL copied${firstUrl}`,
      `URL copied${secondUrl}`,
      `URL copied${secondUrl}`,
      null,
    ])
  })
})
