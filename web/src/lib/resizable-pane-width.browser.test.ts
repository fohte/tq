import { describe, expect, it } from 'vitest'

import { getQueueMaxWidth, getSidebarMaxWidth } from '#lib/resizable-pane-width'

describe('responsive pane width limits', () => {
  it('keeps the desktop panes within the viewport and reserves calendar space', () => {
    expect(
      [768, 1024, 1440].map((viewportWidth) => ({
        viewportWidth,
        sidebarMaxWidth: getSidebarMaxWidth(viewportWidth),
        queueMaxWidth: getQueueMaxWidth(viewportWidth),
        remainingWidth:
          viewportWidth -
          getSidebarMaxWidth(viewportWidth) -
          getQueueMaxWidth(viewportWidth),
      })),
    ).toEqual([
      {
        viewportWidth: 768,
        sidebarMaxWidth: 208,
        queueMaxWidth: 320,
        remainingWidth: 240,
      },
      {
        viewportWidth: 1024,
        sidebarMaxWidth: 400,
        queueMaxWidth: 384,
        remainingWidth: 240,
      },
      {
        viewportWidth: 1440,
        sidebarMaxWidth: 400,
        queueMaxWidth: 640,
        remainingWidth: 400,
      },
    ])
  })
})
