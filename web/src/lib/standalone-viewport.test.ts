import { describe, expect, it } from 'vitest'

import {
  applyStandaloneViewport,
  getViewportContent,
  isStandaloneDisplayMode,
} from '#lib/standalone-viewport'

function createFakeWindow({
  iosStandalone = false,
  matchesDisplayMode = false,
}: {
  iosStandalone?: boolean
  matchesDisplayMode?: boolean
} = {}): Window {
  const fakeWindow = {
    navigator: { standalone: iosStandalone },
    matchMedia: () => ({ matches: matchesDisplayMode }),
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- stub only exercises .navigator.standalone and .matchMedia().matches
  return fakeWindow as unknown as Window
}

function createDocumentWithViewportMeta(): Document {
  const doc = document.implementation.createHTMLDocument()
  const meta = doc.createElement('meta')
  meta.setAttribute('name', 'viewport')
  meta.setAttribute('content', 'width=device-width, initial-scale=1.0')
  doc.head.appendChild(meta)
  return doc
}

describe('isStandaloneDisplayMode', () => {
  it('returns false when neither navigator.standalone nor the display-mode media query match', () => {
    expect(isStandaloneDisplayMode(createFakeWindow())).toBe(false)
  })

  it('returns true when navigator.standalone is true (iOS home screen launch)', () => {
    expect(
      isStandaloneDisplayMode(createFakeWindow({ iosStandalone: true })),
    ).toBe(true)
  })

  it('returns true when the display-mode: standalone media query matches', () => {
    expect(
      isStandaloneDisplayMode(createFakeWindow({ matchesDisplayMode: true })),
    ).toBe(true)
  })
})

describe('getViewportContent', () => {
  it('allows zooming when not standalone', () => {
    expect(getViewportContent(false)).toBe(
      'width=device-width, initial-scale=1.0',
    )
  })

  it('disables zooming when standalone', () => {
    expect(getViewportContent(true)).toBe(
      'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no',
    )
  })
})

describe('applyStandaloneViewport', () => {
  it('rewrites the viewport meta content to disable zoom when standalone', () => {
    const doc = createDocumentWithViewportMeta()

    applyStandaloneViewport(doc, createFakeWindow({ iosStandalone: true }))

    expect(
      doc.querySelector('meta[name="viewport"]')?.getAttribute('content'),
    ).toBe(
      'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no',
    )
  })

  it('keeps the default zoomable viewport content when not standalone', () => {
    const doc = createDocumentWithViewportMeta()

    applyStandaloneViewport(doc, createFakeWindow())

    expect(
      doc.querySelector('meta[name="viewport"]')?.getAttribute('content'),
    ).toBe('width=device-width, initial-scale=1.0')
  })

  it('does nothing when there is no viewport meta tag', () => {
    const doc = document.implementation.createHTMLDocument()

    expect(() => {
      applyStandaloneViewport(doc, createFakeWindow())
    }).not.toThrow()
  })
})
