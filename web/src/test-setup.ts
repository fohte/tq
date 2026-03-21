import '@testing-library/jest-dom/vitest'

import { setProjectAnnotations } from '@storybook/react-vite'
import * as previewAnnotations from '@storybook-config/preview'

setProjectAnnotations(previewAnnotations)

// jsdom does not implement Range.getClientRects, which prosemirror-virtual-cursor relies on.
// Stub it to prevent uncaught exceptions during smoke tests.
if (typeof Range.prototype.getClientRects === 'undefined') {
  Range.prototype.getClientRects = () => ({
    length: 0,
    item: () => null,
    [Symbol.iterator]: [][
      Symbol.iterator
    ] as DOMRectList[typeof Symbol.iterator],
  })
}
if (typeof Range.prototype.getBoundingClientRect === 'undefined') {
  Range.prototype.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      toJSON: () => ({}),
    }) as DOMRect
}

// Milkdown throws contextNotFound during async cleanup in jsdom.
// This is a jsdom limitation, not a real application bug.
const originalListeners = process.listeners('uncaughtException')
process.removeAllListeners('uncaughtException')
process.prependListener('uncaughtException', (error) => {
  const message = error instanceof Error ? error.message : String(error)
  const errorObj = error as unknown as Record<string, unknown>
  const isMilkdownCleanup =
    'code' in errorObj && errorObj['code'] === 'contextNotFound'
  const isProsemirrorJsdom = message.includes(
    'getClientRects is not a function',
  )

  if (isMilkdownCleanup || isProsemirrorJsdom) {
    return
  }

  for (const listener of originalListeners) {
    listener(error, 'uncaughtException')
  }
})
process.on('unhandledRejection', (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason)
  const isMilkdownCleanup =
    reason != null &&
    typeof reason === 'object' &&
    'code' in reason &&
    (reason as Record<string, unknown>)['code'] === 'contextNotFound'
  const isProsemirrorJsdom = message.includes(
    'getClientRects is not a function',
  )

  if (isMilkdownCleanup || isProsemirrorJsdom) {
    return
  }

  throw reason
})
