import { describe, expect, it } from 'vitest'

import { buildMenuTemplate, historyItems, type NavigationHistory } from '#menu'

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

const clickItem = (label: string, can: Can): string[] => {
  const { calls, history } = fakeHistory(can)
  historyItems(history)
    .find((item) => item.label === label)
    ?.click()
  return calls
}

const copiedUrlResult = (
  item:
    | {
        label?: string
        accelerator?: string
      }
    | undefined,
  copiedUrls: string[],
) => ({
  label: item?.label,
  accelerator: item?.accelerator,
  copiedUrls,
})

describe('historyItems', () => {
  it('binds the browser shortcuts', () => {
    const { history } = fakeHistory({ back: true, forward: true })

    expect(
      historyItems(history).map(({ label, accelerator }) => ({
        label,
        accelerator,
      })),
    ).toEqual([
      { label: 'Back', accelerator: 'CmdOrCtrl+[' },
      { label: 'Forward', accelerator: 'CmdOrCtrl+]' },
    ])
  })

  it('Back goes back when there is a previous entry', () => {
    expect(clickItem('Back', { back: true, forward: false })).toEqual([
      'goBack',
    ])
  })

  it('Back does nothing when there is no previous entry', () => {
    expect(clickItem('Back', { back: false, forward: true })).toEqual([])
  })

  it('Forward goes forward when there is a next entry', () => {
    expect(clickItem('Forward', { back: false, forward: true })).toEqual([
      'goForward',
    ])
  })

  it('Forward does nothing when there is no next entry', () => {
    expect(clickItem('Forward', { back: true, forward: false })).toEqual([])
  })
})

describe('buildMenuTemplate', () => {
  it('copies the current page URL from the Page menu', () => {
    const { history } = fakeHistory({ back: false, forward: false })
    let currentUrl = 'https://example.test/tasks/41'
    const copiedUrls: string[] = []
    const menu = buildMenuTemplate(
      history,
      { getURL: () => currentUrl },
      {
        writeText: (url) => {
          copiedUrls.push(url)
        },
      },
    )
    const pageMenu = menu.find(
      (item) => 'label' in item && item.label === 'Page',
    )
    const copyUrlItem =
      pageMenu && 'submenu' in pageMenu ? pageMenu.submenu[0] : undefined

    currentUrl = 'https://example.test/tasks/42'
    copyUrlItem?.click()

    expect(copiedUrlResult(copyUrlItem, copiedUrls)).toEqual({
      label: 'Copy URL',
      accelerator: 'CmdOrCtrl+Shift+C',
      copiedUrls: ['https://example.test/tasks/42'],
    })
  })
})
