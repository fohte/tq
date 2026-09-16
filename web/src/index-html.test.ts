import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { pwaManifest } from '#lib/pwa-manifest'

const dirname = path.dirname(fileURLToPath(import.meta.url))

function extractMetaContent(html: string, name: string): string | undefined {
  return html.match(
    new RegExp(`<meta\\s+name="${name}"\\s+content="([^"]*)"`),
  )?.[1]
}

function extractLinkHrefs(html: string, rel: string): string[] {
  return Array.from(
    html.matchAll(new RegExp(`<link\\s+rel="${rel}"\\s+href="([^"]*)"`, 'g')),
    (match) => match[1],
  ).filter((href): href is string => href !== undefined)
}

function readIndexHtmlHead() {
  const html = fs.readFileSync(
    path.resolve(dirname, '..', 'index.html'),
    'utf-8',
  )

  return {
    themeColor: extractMetaContent(html, 'theme-color'),
    appleMobileWebAppCapable: extractMetaContent(
      html,
      'apple-mobile-web-app-capable',
    ),
    appleMobileWebAppTitle: extractMetaContent(
      html,
      'apple-mobile-web-app-title',
    ),
    appleTouchIconHrefs: extractLinkHrefs(html, 'apple-touch-icon'),
    faviconHrefs: extractLinkHrefs(html, 'icon'),
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
