import { EditorState } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'
import type { CreateReactWidgetView } from '@prosemirror-adapter/react'
import { describe, expect, it } from 'vitest'

import { createInlineReferencePlugin } from '#lib/inline-reference/plugin'
import {
  buildModePlugin,
  fakeCtx,
  schema,
} from '#lib/inline-reference/test-helpers'
import type { InlineReferenceProvider } from '#lib/inline-reference/types'

interface FakeData {
  n: number
}

const fakeProvider: InlineReferenceProvider<FakeData> = {
  id: 'fake',
  findMatches(text) {
    return [...text.matchAll(/@(\d+)/g)].map((match) => {
      const digits = match[1]
      if (digits == null) throw new Error('capture group 1 always matches \\d+')
      return {
        start: match.index,
        end: match.index + match[0].length,
        raw: match[0],
        data: { n: Number(digits) },
      }
    })
  },
  Chip: () => null,
  Card: () => null,
}

// This file only exercises `createInlineReferencePlugin`'s own decoration
// wiring (matching, selection suppression, and passing each match's data/raw
// through to the widget). Actually rendering a widget as a React portal is
// @prosemirror-adapter/react's own tested responsibility, so this fake
// factory skips it and just returns a Decoration carrying the spec it was
// given, the same shape the real widgetViewFactory produces.
function fakeWidgetViewFactory(): CreateReactWidgetView {
  return () => (pos, spec) =>
    Decoration.widget(pos, () => document.createElement('span'), spec)
}

function docWithText(text: string) {
  return schema.node('doc', null, [
    schema.node('paragraph', null, [schema.text(text)]),
  ])
}

function docWithHeadingText(text: string) {
  return schema.node('doc', null, [
    schema.node('heading', null, [schema.text(text)]),
  ])
}

async function buildPlugin() {
  const wrapped = createInlineReferencePlugin(
    fakeProvider,
    fakeWidgetViewFactory(),
  )
  await wrapped(fakeCtx)()
  return wrapped.plugin()
}

async function decorationsForDoc(
  doc: ReturnType<typeof docWithText>,
  mode: 'view' | 'edit',
) {
  const plugin = await buildPlugin()
  const modePlugin = await buildModePlugin(mode)
  const state = EditorState.create({ doc, schema, plugins: [modePlugin] })

  const decorationsProp = plugin.props.decorations
  if (decorationsProp == null)
    throw new Error('plugin always defines decorations')
  const source = decorationsProp.call(plugin, state)
  if (!(source instanceof DecorationSet))
    throw new Error('plugin always builds decorations via DecorationSet.create')
  return source.find()
}

async function decorationsFor(text: string, mode: 'view' | 'edit') {
  return decorationsForDoc(docWithText(text), mode)
}

// Reduces a Decoration to the fields these tests assert on. Decoration
// instances also hold a closure-based `type` (the widget's `toDOM`/inline
// `toDOM`), which can't be compared by value, so it's deliberately excluded.
function normalize(decorations: readonly Decoration[]) {
  return decorations
    .map((d) => ({ from: d.from, to: d.to, spec: d.spec as unknown }))
    .sort((a, b) => a.from - b.from || a.to - b.to)
}

describe('createInlineReferencePlugin', () => {
  it('hides the raw match and creates a widget carrying its data and raw text', async () => {
    const decorations = await decorationsFor('see @1 here', 'view')

    expect(normalize(decorations)).toEqual([
      {
        from: 5,
        to: 5,
        spec: { key: 'fake:@1:5', side: 1, data: { n: 1 }, raw: '@1' },
      },
      { from: 5, to: 7, spec: {} },
    ])
  })

  it('creates a decoration pair for each of multiple matches', async () => {
    const decorations = await decorationsFor('see @1 and @2 here', 'view')

    expect(normalize(decorations)).toEqual([
      {
        from: 5,
        to: 5,
        spec: { key: 'fake:@1:5', side: 1, data: { n: 1 }, raw: '@1' },
      },
      { from: 5, to: 7, spec: {} },
      {
        from: 12,
        to: 12,
        spec: { key: 'fake:@2:12', side: 1, data: { n: 2 }, raw: '@2' },
      },
      { from: 12, to: 14, spec: {} },
    ])
  })

  it('produces no decorations in edit mode', async () => {
    const decorations = await decorationsFor('see @1 here', 'edit')

    expect(decorations).toEqual([])
  })

  it('renders a card when a paragraph is exactly one reference', async () => {
    const decorations = await decorationsFor('@1', 'view')

    expect(normalize(decorations)).toEqual([
      {
        from: 1,
        to: 1,
        spec: { key: 'fake:card:@1:1', side: 1, data: { n: 1 }, raw: '@1' },
      },
      { from: 1, to: 3, spec: {} },
    ])
  })

  it('renders a card when a paragraph is one reference plus surrounding whitespace, hiding the whole run', async () => {
    const decorations = await decorationsFor('  @1  ', 'view')

    expect(normalize(decorations)).toEqual([
      { from: 1, to: 7, spec: {} },
      {
        from: 3,
        to: 3,
        spec: { key: 'fake:card:@1:3', side: 1, data: { n: 1 }, raw: '@1' },
      },
    ])
  })

  it('does not render a card for a non-paragraph textblock, even when its whole text is one reference', async () => {
    const decorations = await decorationsForDoc(
      docWithHeadingText('@1'),
      'view',
    )

    expect(normalize(decorations)).toEqual([
      {
        from: 1,
        to: 1,
        spec: { key: 'fake:@1:1', side: 1, data: { n: 1 }, raw: '@1' },
      },
      { from: 1, to: 3, spec: {} },
    ])
  })
})
