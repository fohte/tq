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

// jsdom does not implement matchMedia. Default to desktop (matches: true) so
// components using useIsDesktop render their default layout; tests exercising
// the narrow-viewport branch override this per-suite (see project-gantt-view.test.tsx).
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
