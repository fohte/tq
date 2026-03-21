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
