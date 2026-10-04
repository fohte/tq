import { runInNewContext } from 'node:vm'

import { describe, expect, it, vi } from 'vitest'

import { buildMenuTemplate, type NavigationHistory } from '#menu'

type Can = { back: boolean; forward: boolean }

// Records which history methods were called. `can` sets each direction
// independently, since the realistic states are one-directional (e.g. right
// after the first navigation there is a way back but none forward).
const fakeHistory = (can: Can) => {
  const calls: string[] = []
  const history: NavigationHistory = {
    canGoBack: () => can.back,
    goBack: () => calls.push('goBack'),
    canGoForward: () => can.forward,
    goForward: () => calls.push('goForward'),
  }
  return { calls, history }
}

const menuWithHistory = (can: Can) => {
  const { calls, history } = fakeHistory(can)
  const menu = buildMenuTemplate(history, fakePage(), { writeText: () => {} })
  return { calls, menu }
}

const fakePage = (
  getURL: () => string = () => '',
  executeJavaScript: (script: string) => Promise<unknown> = () =>
    Promise.resolve(''),
) => ({
  getURL,
  executeJavaScript,
})

type MenuTemplateItem = ReturnType<typeof buildMenuTemplate>[number]

const menuItems = (
  menu: MenuTemplateItem[],
  label: string,
): MenuTemplateItem[] => {
  const submenu = menu.find((item) => item.label === label)?.submenu
  return Array.isArray(submenu) ? submenu : []
}

const clickMenuItem = (
  menu: MenuTemplateItem[],
  menuLabel: string,
  itemLabel: string,
): void => {
  const item = menuItems(menu, menuLabel).find(
    (menuItem) => menuItem.label === itemLabel,
  )
  item?.click?.()
}

describe('History menu', () => {
  it('binds the browser shortcuts', () => {
    const { menu } = menuWithHistory({ back: true, forward: true })

    expect(
      menuItems(menu, 'History').map(({ label, accelerator }) => ({
        label,
        accelerator,
      })),
    ).toEqual([
      { label: 'Back', accelerator: 'CmdOrCtrl+[' },
      { label: 'Forward', accelerator: 'CmdOrCtrl+]' },
    ])
  })

  it('Back goes back when there is a previous entry', () => {
    const { calls, menu } = menuWithHistory({ back: true, forward: false })
    clickMenuItem(menu, 'History', 'Back')

    expect(calls).toEqual(['goBack'])
  })

  it('Back does nothing when there is no previous entry', () => {
    const { calls, menu } = menuWithHistory({ back: false, forward: true })
    clickMenuItem(menu, 'History', 'Back')

    expect(calls).toEqual([])
  })

  it('Forward goes forward when there is a next entry', () => {
    const { calls, menu } = menuWithHistory({ back: false, forward: true })
    clickMenuItem(menu, 'History', 'Forward')

    expect(calls).toEqual(['goForward'])
  })

  it('Forward does nothing when there is no next entry', () => {
    const { calls, menu } = menuWithHistory({ back: true, forward: false })
    clickMenuItem(menu, 'History', 'Forward')

    expect(calls).toEqual([])
  })
})

describe('Page menu', () => {
  it('binds the Page menu shortcuts', () => {
    const menu = buildMenuTemplate(
      fakeHistory({ back: false, forward: false }).history,
      fakePage(),
      { writeText: () => {} },
    )

    expect(
      menuItems(menu, 'Page').map(({ label, accelerator }) => ({
        label,
        accelerator,
      })),
    ).toEqual([
      { label: 'Find…', accelerator: 'CmdOrCtrl+F' },
      { label: 'Copy URL', accelerator: 'CmdOrCtrl+Shift+C' },
    ])
  })

  it('opens the in-page find bar', async () => {
    const events: string[] = []
    class FakeCustomEvent {
      constructor(readonly type: string) {}
    }
    const menu = buildMenuTemplate(
      fakeHistory({ back: false, forward: false }).history,
      fakePage(undefined, (script) => {
        runInNewContext(script, {
          window: {
            dispatchEvent: (event: FakeCustomEvent) => {
              events.push(event.type)
              return true
            },
          },
          CustomEvent: FakeCustomEvent,
        })
        return Promise.resolve('')
      }),
      { writeText: () => {} },
    )

    clickMenuItem(menu, 'Page', 'Find…')
    await Promise.resolve()

    expect(events).toEqual(['tq:find'])
  })

  it('logs when the page cannot open the find bar', async () => {
    const failure = new Error('renderer unavailable')
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    const menu = buildMenuTemplate(
      fakeHistory({ back: false, forward: false }).history,
      fakePage(undefined, () => Promise.reject(failure)),
      { writeText: () => {} },
    )

    clickMenuItem(menu, 'Page', 'Find…')
    await Promise.resolve()
    const loggedCalls = errorLog.mock.calls
    errorLog.mockRestore()

    expect(loggedCalls).toEqual([['failed to open the find bar', failure]])
  })

  it('copies the URL the page has at click time', () => {
    let currentUrl = 'https://example.test/tasks/41'
    const copiedUrls: string[] = []
    const menu = buildMenuTemplate(
      fakeHistory({ back: false, forward: false }).history,
      fakePage(() => currentUrl),
      {
        writeText: (url) => {
          copiedUrls.push(url)
        },
      },
    )

    currentUrl = 'https://example.test/tasks/42'
    clickMenuItem(menu, 'Page', 'Copy URL')

    expect(copiedUrls).toEqual(['https://example.test/tasks/42'])
  })

  it('notifies the page of the copied URL', () => {
    const url = 'https://example.test/#a\\b"c'
    const events: { type: string; detail: unknown }[] = []
    class FakeCustomEvent {
      constructor(
        readonly type: string,
        readonly options: { detail?: unknown },
      ) {}

      get detail() {
        return this.options.detail
      }
    }
    const fakeWindow = {
      dispatchEvent: (event: FakeCustomEvent) => {
        events.push({ type: event.type, detail: event.detail })
        return true
      },
    }
    const menu = buildMenuTemplate(
      fakeHistory({ back: false, forward: false }).history,
      fakePage(
        () => url,
        (script) => {
          runInNewContext(script, {
            window: fakeWindow,
            CustomEvent: FakeCustomEvent,
          })
          return Promise.resolve('')
        },
      ),
      { writeText: () => {} },
    )

    clickMenuItem(menu, 'Page', 'Copy URL')

    expect(events).toEqual([{ type: 'tq:url-copied', detail: { url } }])
  })

  it('logs when the page cannot display the copied URL toast', async () => {
    const failure = new Error('renderer unavailable')
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    const menu = buildMenuTemplate(
      fakeHistory({ back: false, forward: false }).history,
      fakePage(
        () => 'https://example.test/tasks/42',
        () => Promise.reject(failure),
      ),
      { writeText: () => {} },
    )

    clickMenuItem(menu, 'Page', 'Copy URL')
    await Promise.resolve()
    const loggedCalls = errorLog.mock.calls
    errorLog.mockRestore()

    expect(loggedCalls).toEqual([
      ['failed to show the URL copied toast', failure],
    ])
  })
})
