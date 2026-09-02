import '@testing-library/jest-dom/vitest'

import { setProjectAnnotations } from '@storybook/react-vite'
import * as previewAnnotations from '@storybook-config/preview'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})

setProjectAnnotations(previewAnnotations)

// jsdom does not implement Range.getClientRects, which prosemirror-virtual-cursor relies on.
// Stub it to prevent uncaught exceptions during smoke tests.
if (typeof Range.prototype.getClientRects === 'undefined') {
  Range.prototype.getClientRects = () => ({
    length: 0,
    item: () => null,
    [Symbol.iterator]: [][Symbol.iterator],
  })
}
if (typeof Range.prototype.getBoundingClientRect === 'undefined') {
  Range.prototype.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    toJSON: () => ({}),
  })
}

// jsdom lacks Element.scrollTo, and scrollTop assignment doesn't dispatch
// a scroll event — @tanstack/react-virtual's scrollToIndex() needs both.
if (typeof Element.prototype.scrollTo !== 'function') {
  Element.prototype.scrollTo = function (
    this: Element,
    optionsOrX?: ScrollToOptions | number,
    y?: number,
  ) {
    if (typeof optionsOrX === 'number') {
      this.scrollLeft = optionsOrX
      if (y != null) this.scrollTop = y
    } else {
      if (optionsOrX?.top != null) this.scrollTop = optionsOrX.top
      if (optionsOrX?.left != null) this.scrollLeft = optionsOrX.left
    }
    this.dispatchEvent(new Event('scroll'))
  }
}

// jsdom's window.scrollTo() is a no-op stub (logs "not implemented",
// never updates scrollX/scrollY or dispatches a scroll event) —
// useWindowVirtualizer's scrollToIndex() calls it, and its own
// scroll-position tracking (observeWindowOffset) needs the resulting
// scroll event to react.
window.scrollTo = function (optionsOrX?: ScrollToOptions | number, y?: number) {
  if (typeof optionsOrX === 'number') {
    Object.defineProperty(window, 'scrollX', {
      configurable: true,
      value: optionsOrX,
    })
    if (y != null) {
      Object.defineProperty(window, 'scrollY', { configurable: true, value: y })
    }
  } else {
    if (optionsOrX?.left != null) {
      Object.defineProperty(window, 'scrollX', {
        configurable: true,
        value: optionsOrX.left,
      })
    }
    if (optionsOrX?.top != null) {
      Object.defineProperty(window, 'scrollY', {
        configurable: true,
        value: optionsOrX.top,
      })
    }
  }
  window.dispatchEvent(new Event('scroll'))
}

// jsdom always reports offsetHeight=0, which @tanstack/react-virtual reads
// for each row's height on mount via measureElement's fallback — left at 0,
// the row-size cache collapses onto a single arbitrary row. Fake it to a
// nonzero value, scoped to this feature's own row marker so unrelated tests
// are unaffected. (The viewport size itself comes from window.innerHeight
// for useWindowVirtualizer, which jsdom already defaults to nonzero.)
Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
  configurable: true,
  get(this: HTMLElement) {
    if (this.matches('[data-testid="task-tree-row"]')) return 40
    return 0
  },
})

// jsdom does not implement matchMedia. Default to desktop (matches: true) so
// components using useIsDesktop render their default layout; tests exercising
// the narrow-viewport branch override this per-suite (see calendar-view.test.tsx).
if (typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

// Milkdown throws contextNotFound during async cleanup in jsdom, and
// prosemirror-virtual-cursor hits the getClientRects stub above during the
// same teardown. Both are jsdom limitations, not real application bugs.
function isKnownMilkdownJsdomNoise(errorLike: unknown): boolean {
  const message =
    errorLike instanceof Error ? errorLike.message : String(errorLike)

  const isMilkdownCleanup =
    typeof errorLike === 'object' &&
    errorLike != null &&
    'code' in errorLike &&
    errorLike.code === 'contextNotFound'
  const isProsemirrorJsdom = message.includes(
    'getClientRects is not a function',
  )

  return isMilkdownCleanup || isProsemirrorJsdom
}

const originalListeners = process.listeners('uncaughtException')
process.removeAllListeners('uncaughtException')
// Type as unknown because JS allows throwing any value, not just Error
process.prependListener('uncaughtException', (error: unknown) => {
  // @milkdown/ctx's Timer never clears its internal fallback setTimeout
  // (default 3s), even after the timer resolves normally. If it fires after
  // this test file's jsdom environment has been torn down, the global
  // `removeEventListener` is already gone.
  const isMilkdownTimerCleanup =
    error instanceof ReferenceError &&
    error.message === 'removeEventListener is not defined' &&
    error.stack?.includes('@milkdown/ctx') === true

  if (isKnownMilkdownJsdomNoise(error) || isMilkdownTimerCleanup) {
    return
  }

  for (const listener of originalListeners) {
    listener(
      error instanceof Error ? error : new Error(String(error)),
      'uncaughtException',
    )
  }
})
process.on('unhandledRejection', (reason) => {
  if (isKnownMilkdownJsdomNoise(reason)) {
    return
  }

  // eslint-disable-next-line no-restricted-syntax -- Node's unhandledRejection handler contract: re-throwing is what crashes the process to fail the test run
  throw reason
})
