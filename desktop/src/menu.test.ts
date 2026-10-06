import { runInNewContext } from 'node:vm'

import { describe, expect, it, vi } from 'vitest'

import {
  buildMenuTemplate,
  type NavigationHistory,
  type SideWindowMenuActions,
} from '#menu'

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
  const menu = buildTestMenuTemplate(history, fakePage(), {
    writeText: () => {},
  })
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

function buildTestMenuTemplate(
  history: NavigationHistory,
  webContents: ReturnType<typeof fakePage>,
  clipboard: { writeText: (text: string) => void },
  sideWindow: SideWindowMenuActions = {
    open: () => {},
    alwaysOnTop: false,
    setAlwaysOnTop: () => {},
  },
) {
  return buildMenuTemplate(history, webContents, clipboard, sideWindow)
}

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
  item?.click?.({
    checked: item.type === 'checkbox' ? !(item.checked ?? false) : false,
  })
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
    const menu = buildTestMenuTemplate(
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
    const menu = buildTestMenuTemplate(
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
    const menu = buildTestMenuTemplate(
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
    const menu = buildTestMenuTemplate(
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
    const menu = buildTestMenuTemplate(
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
    const menu = buildTestMenuTemplate(
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
describe('Window menu', () => {
  it('includes a command to open the side window in the Window menu', () => {
    const { history } = fakeHistory({ back: false, forward: false })
    const menu = buildMenuTemplate(
      history,
      fakePage(),
      { writeText: () => {} },
      {
        open: () => {},
        alwaysOnTop: false,
        setAlwaysOnTop: () => {},
      },
    )

    expect(
      menuItems(menu, 'Window').map(
        ({ label, role, type }) => label ?? role ?? type,
      ),
    ).toEqual([
      'Open Side Window',
      'Keep Side Window on Top',
      'separator',
      'minimize',
      'zoom',
      'separator',
      'front',
      'separator',
      'window',
    ])
  })

  it('calls the side-window action when the menu command is selected', () => {
    const { history } = fakeHistory({ back: false, forward: false })
    const openSideWindow = vi.fn()
    const menu = buildMenuTemplate(
      history,
      fakePage(),
      { writeText: () => {} },
      {
        open: openSideWindow,
        alwaysOnTop: false,
        setAlwaysOnTop: () => {},
      },
    )
    clickMenuItem(menu, 'Window', 'Open Side Window')

    expect(openSideWindow.mock.calls).toEqual([[]])
  })

  it('shows the saved always-on-top state in the checkbox', () => {
    const { history } = fakeHistory({ back: false, forward: false })
    const menu = buildTestMenuTemplate(
      history,
      fakePage(),
      { writeText: () => {} },
      {
        open: () => {},
        alwaysOnTop: true,
        setAlwaysOnTop: () => {},
      },
    )
    const item = menuItems(menu, 'Window').find(
      (menuItem) => menuItem.label === 'Keep Side Window on Top',
    )

    expect(
      menuItems(menu, 'Window')
        .filter((menuItem) => menuItem.label === item?.label)
        .map(({ label, type, checked }) => [label, type, checked]),
    ).toEqual([['Keep Side Window on Top', 'checkbox', true]])
  })

  it('applies the checkbox state when the setting is selected', () => {
    const { history } = fakeHistory({ back: false, forward: false })
    const setAlwaysOnTop = vi.fn()
    const menu = buildTestMenuTemplate(
      history,
      fakePage(),
      { writeText: () => {} },
      {
        open: () => {},
        alwaysOnTop: false,
        setAlwaysOnTop,
      },
    )

    clickMenuItem(menu, 'Window', 'Keep Side Window on Top')

    expect(setAlwaysOnTop.mock.calls).toEqual([[true]])
  })
})
