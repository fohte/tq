import type { Ctx } from '@milkdown/kit/ctx'
import { Schema } from '@milkdown/kit/prose/model'
import { EditorState, TextSelection } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'
import type { CreateReactWidgetView } from '@prosemirror-adapter/react'
import { describe, expect, it } from 'vitest'

import { createInlineReferencePlugin } from '#lib/inline-reference/plugin'
import type { InlineReferenceProvider } from '#lib/inline-reference/types'

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: {
      content: 'inline*',
      group: 'block',
      toDOM: () => ['p', 0],
    },
    text: { group: 'inline' },
  },
  marks: {},
})

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

async function buildPlugin() {
  // `createInlineReferencePlugin` wraps a plain `prosemirror-state` `Plugin`
  // in Milkdown's `$prose` lifecycle, which needs a real `Ctx` to resolve
  // schema timing and register the plugin. The wrapped callback itself never
  // reads `ctx`, so a stub satisfying only the two methods `$prose` calls is
  // enough to unwrap the underlying `Plugin`.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- stub only exercises .wait/.update, see comment above
  const fakeCtx = {
    wait: async () => {},
    update: () => {},
  } as unknown as Ctx
  const wrapped = createInlineReferencePlugin(
    fakeProvider,
    fakeWidgetViewFactory(),
  )
  await wrapped(fakeCtx)()
  return wrapped.plugin()
}

// Defaults the selection to the doc's end, away from any match, since a
// decoration is suppressed wherever the selection touches it (see
// selection-overlap.ts) — most cases here care about the decorations
// themselves, not that suppression rule.
async function decorationsFor(
  text: string,
  selection?: { from: number; to: number },
) {
  const plugin = await buildPlugin()
  const doc = docWithText(text)
  const sel = selection ?? {
    from: TextSelection.atEnd(doc).from,
    to: TextSelection.atEnd(doc).to,
  }
  const initialState = EditorState.create({ doc, schema })
  const state = initialState.apply(
    initialState.tr.setSelection(TextSelection.create(doc, sel.from, sel.to)),
  )

  const decorationsProp = plugin.props.decorations
  if (decorationsProp == null)
    throw new Error('plugin always defines decorations')
  const source = decorationsProp.call(plugin, state)
  if (!(source instanceof DecorationSet))
    throw new Error('plugin always builds decorations via DecorationSet.create')
  return source.find()
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
    const decorations = await decorationsFor('see @1 here')

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
    const decorations = await decorationsFor('see @1 and @2 here')

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

  it('suppresses the decoration pair for a match the selection touches', async () => {
    // "see @1 here": the match spans doc positions [5, 7); a collapsed
    // selection at 6 sits inside it.
    const decorations = await decorationsFor('see @1 here', {
      from: 6,
      to: 6,
    })

    expect(decorations).toEqual([])
  })
})
