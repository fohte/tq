import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { pwaManifest } from '@web/lib/pwa-manifest'
import { describe, expect, it } from 'vitest'

const dirname = path.dirname(fileURLToPath(import.meta.url))

function readIndexHtmlHead() {
  const html = fs.readFileSync(
    path.resolve(dirname, '..', 'index.html'),
    'utf-8',
  )
  const doc = new DOMParser().parseFromString(html, 'text/html')

  return {
    themeColor: doc
      .querySelector('meta[name="theme-color"]')
      ?.getAttribute('content'),
    appleMobileWebAppCapable: doc
      .querySelector('meta[name="apple-mobile-web-app-capable"]')
      ?.getAttribute('content'),
    appleMobileWebAppTitle: doc
      .querySelector('meta[name="apple-mobile-web-app-title"]')
      ?.getAttribute('content'),
    appleTouchIconHrefs: Array.from(
      doc.querySelectorAll('link[rel="apple-touch-icon"]'),
    ).map((el) => el.getAttribute('href')),
    faviconHrefs: Array.from(doc.querySelectorAll('link[rel="icon"]')).map(
      (el) => el.getAttribute('href'),
    ),
  }
}

describe('index.html', () => {
  it('declares the favicon and the Apple home screen meta/link tags', () => {
    expect(readIndexHtmlHead()).toEqual({
      themeColor: pwaManifest.theme_color,
      appleMobileWebAppCapable: 'yes',
      appleMobileWebAppTitle: 'tq',
      appleTouchIconHrefs: ['/apple-touch-icon.png'],
      faviconHrefs: ['/favicon.ico'],
    })
  })
})
