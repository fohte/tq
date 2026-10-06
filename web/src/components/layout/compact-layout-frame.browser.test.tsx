import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CompactLayoutFrame } from '#components/layout/compact-layout-frame'

type NavigationRequests = [path: string][]

function setDesktopApi(openInMainWindow?: (path: string) => void) {
  if (openInMainWindow == null) {
    delete window.tqDesktop
    return
  }

  window.tqDesktop = {
    openInMainWindow,
    onNavigateRequest: () => () => {},
  }
}

function linkClickResult(
  requests: NavigationRequests,
  clickDefaultPrevented: boolean[],
) {
  return { requests, clickDefaultPrevented }
}

function controlClickResult(requests: NavigationRequests, actionCalls: number) {
  return { requests, actionCalls }
}

describe('CompactLayoutFrame', () => {
  beforeEach(() => {
    setDesktopApi()
  })

  afterEach(() => {
    setDesktopApi()
  })

  it('opens same-origin links in the main window and prevents side-window navigation', async () => {
    const openInMainWindow = vi.fn<(path: string) => void>()
    setDesktopApi(openInMainWindow)

    const user = userEvent.setup()
    render(
      <CompactLayoutFrame>
        <a href="/tasks/task-123?source=compact#comments">
          <span>open task</span>
        </a>
      </CompactLayoutFrame>,
    )

    const link = screen.getByRole('link', { name: 'open task' })
    const clickDefaultPrevented: boolean[] = []
    link.addEventListener('click', (event) => {
      clickDefaultPrevented.push(event.defaultPrevented)
    })
    await user.click(link)

    expect(
      linkClickResult(openInMainWindow.mock.calls, clickDefaultPrevented),
    ).toEqual({
      requests: [['/tasks/task-123?source=compact#comments']],
      clickDefaultPrevented: [true],
    })
  })

  it('leaves clicks on interactive row controls to their own handlers', async () => {
    const openInMainWindow = vi.fn<(path: string) => void>()
    const onAction = vi.fn()
    setDesktopApi(openInMainWindow)

    const user = userEvent.setup()
    render(
      <CompactLayoutFrame>
        <a href="/tasks/task-123">
          <button
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onAction()
            }}
          >
            edit estimate
          </button>
        </a>
      </CompactLayoutFrame>,
    )

    const button = screen.getByRole('button', { name: 'edit estimate' })
    await user.click(button)

    expect(
      controlClickResult(
        openInMainWindow.mock.calls,
        onAction.mock.calls.length,
      ),
    ).toEqual({ requests: [], actionCalls: 1 })
  })

  it('preserves normal link behavior when the desktop API is unavailable', () => {
    render(
      <CompactLayoutFrame>
        <a href="/tasks/task-123">open task</a>
      </CompactLayoutFrame>,
    )

    const link = screen.getByRole('link', { name: 'open task' })
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      button: 0,
    })
    link.dispatchEvent(clickEvent)

    expect(clickEvent.defaultPrevented).toBe(false)
  })
})
