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

function createDocumentWithViewportMeta(
  content = 'width=device-width, initial-scale=1.0',
): Document {
  const doc = document.implementation.createHTMLDocument()
  const meta = doc.createElement('meta')
  meta.setAttribute('name', 'viewport')
  meta.setAttribute('content', content)
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
  it('leaves the content unchanged when not standalone', () => {
    expect(
      getViewportContent('width=device-width, initial-scale=1.0', false),
    ).toBe('width=device-width, initial-scale=1.0')
  })

  it('appends the zoom-disabling directives when standalone', () => {
    expect(
      getViewportContent('width=device-width, initial-scale=1.0', true),
    ).toBe(
      'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no',
    )
  })
})

describe('applyStandaloneViewport', () => {
  it('appends zoom-disabling directives to whatever content is already set when standalone', () => {
    const doc = createDocumentWithViewportMeta(
      'width=device-width, initial-scale=1.0, viewport-fit=cover',
    )

    applyStandaloneViewport(doc, createFakeWindow({ iosStandalone: true }))

    expect(
      doc.querySelector('meta[name="viewport"]')?.getAttribute('content'),
    ).toBe(
      'width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1.0, user-scalable=no',
    )
  })

  it('keeps the existing viewport content untouched when not standalone', () => {
    const doc = createDocumentWithViewportMeta(
      'width=device-width, initial-scale=1.0, viewport-fit=cover',
    )

    applyStandaloneViewport(doc, createFakeWindow())

    expect(
      doc.querySelector('meta[name="viewport"]')?.getAttribute('content'),
    ).toBe('width=device-width, initial-scale=1.0, viewport-fit=cover')
  })

  it('does nothing when there is no viewport meta tag', () => {
    const doc = document.implementation.createHTMLDocument()

    expect(() => {
      applyStandaloneViewport(doc, createFakeWindow())
    }).not.toThrow()
  })
})
