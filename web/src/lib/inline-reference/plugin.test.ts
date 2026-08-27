import {
  EditorState,
  Selection,
  TextSelection,
} from '@milkdown/kit/prose/state'
import type { EditorView } from '@milkdown/kit/prose/view'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'
import type { CreateReactWidgetView } from '@prosemirror-adapter/react'
import { describe, expect, it, vi } from 'vitest'

import { createInlineReferencePlugin } from '#lib/inline-reference/plugin'
import { fakeCtx, schema } from '#lib/inline-reference/test-helpers'
import type { InlineReferenceProvider } from '#lib/inline-reference/types'
import { createInlineReferenceViewModeStore } from '#lib/inline-reference/view-mode'

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

// A paragraph that's entirely one reference leaves no other position in a
// single-paragraph doc for a selection to sit outside it, so tests needing
// that use multiple paragraphs.
function docWithParagraphs(...texts: string[]) {
  return schema.node(
    'doc',
    null,
    texts.map((text) => schema.node('paragraph', null, [schema.text(text)])),
  )
}

function docWithText(text: string) {
  return docWithParagraphs(text)
}

async function buildPlugin(mode: 'view' | 'edit') {
  const viewModeStore = createInlineReferenceViewModeStore(mode)
  const wrapped = createInlineReferencePlugin(
    fakeProvider,
    fakeWidgetViewFactory(),
    viewModeStore,
  )
  await wrapped(fakeCtx)()
  return wrapped.plugin()
}

// A minimal stand-in for the real EditorView. `dom` is needed because the
// plugin's `view()` hook always attaches focus/blur listeners to it; `focused`
// defaults to true since most tests are exercising selection-overlap
// behavior, which only matters once the view has focus — see the dedicated
// "lacks focus" test for the unfocused case.
function fakeEditorView(focused: boolean) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the plugin only calls hasFocus() and attaches dom listeners on the view it's given, so a full EditorView isn't needed
  return {
    dom: document.createElement('div'),
    hasFocus: () => focused,
  } as unknown as EditorView
}

// A stand-in for the real EditorView the plugin's `view()` hook uses to
// listen for native focus/blur events and force a redecoration.
function fakeDispatchableEditorView() {
  const dom = document.createElement('div')
  const dispatch = vi.fn()
  const state = EditorState.create({ doc: docWithText('x'), schema })
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the plugin's view() hook only reads `.dom`, `.state`, and `.dispatch()` off the view it's given, so a full EditorView isn't needed
  const view = { dom, state, dispatch } as unknown as EditorView
  return { view, dom, dispatch }
}

async function decorationsForDoc(
  doc: ReturnType<typeof docWithText>,
  mode: 'view' | 'edit',
  selection?: Selection,
  focused = true,
) {
  const plugin = await buildPlugin(mode)
  plugin.spec.view?.(fakeEditorView(focused))
  const state = EditorState.create({
    doc,
    schema,
    ...(selection == null ? {} : { selection }),
  })

  const decorationsProp = plugin.props.decorations
  if (decorationsProp == null)
    throw new Error('plugin always defines decorations')
  const source = decorationsProp.call(plugin, state)
  if (!(source instanceof DecorationSet))
    throw new Error('plugin always builds decorations via DecorationSet.create')
  return source.find()
}

async function decorationsFor(
  text: string,
  mode: 'view' | 'edit',
  selection?: Selection,
) {
  return decorationsForDoc(docWithText(text), mode, selection)
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

  // Selection sits in the trailing paragraph, outside the reference, so the
  // selection-overlap check doesn't suppress this card.
  it('renders a card when a paragraph is exactly one reference', async () => {
    const doc = docWithParagraphs('@1', 'x')
    const decorations = await decorationsForDoc(
      doc,
      'view',
      Selection.atEnd(doc),
    )

    expect(normalize(decorations)).toEqual([
      {
        from: 1,
        to: 1,
        spec: { key: 'fake:card:@1:1', side: 1, data: { n: 1 }, raw: '@1' },
      },
      { from: 1, to: 3, spec: {} },
    ])
  })

  // Selection sits in the trailing paragraph, outside the reference, so the
  // selection-overlap check doesn't suppress this card.
  it('renders a card when a paragraph is one reference plus surrounding whitespace, hiding the whole run', async () => {
    const doc = docWithParagraphs('  @1  ', 'x')
    const decorations = await decorationsForDoc(
      doc,
      'view',
      Selection.atEnd(doc),
    )

    expect(normalize(decorations)).toEqual([
      { from: 1, to: 7, spec: {} },
      {
        from: 3,
        to: 3,
        spec: { key: 'fake:card:@1:3', side: 1, data: { n: 1 }, raw: '@1' },
      },
    ])
  })

  // Selection sits in the trailing paragraph, outside the reference, so the
  // selection-overlap check doesn't suppress this chip (this textblock is a
  // heading, not a paragraph, so it's a chip rather than a card).
  it('does not render a card for a non-paragraph textblock, even when its whole text is one reference', async () => {
    const doc = schema.node('doc', null, [
      schema.node('heading', null, [schema.text('@1')]),
      schema.node('paragraph', null, [schema.text('x')]),
    ])
    const decorations = await decorationsForDoc(
      doc,
      'view',
      Selection.atEnd(doc),
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

  it('suppresses the chip and shows the raw source when the selection is inside the match', async () => {
    const doc = docWithText('see @1 here')
    const decorations = await decorationsForDoc(
      doc,
      'view',
      TextSelection.create(doc, 6),
    )

    expect(decorations).toEqual([])
  })

  it('suppresses the chip when the selection sits exactly on the match boundary (start)', async () => {
    const doc = docWithText('see @1 here')
    const decorations = await decorationsForDoc(
      doc,
      'view',
      TextSelection.create(doc, 5),
    )

    expect(decorations).toEqual([])
  })

  it('suppresses the chip when the selection sits exactly on the match boundary (end)', async () => {
    const doc = docWithText('see @1 here')
    const decorations = await decorationsForDoc(
      doc,
      'view',
      TextSelection.create(doc, 7),
    )

    expect(decorations).toEqual([])
  })

  it('suppresses the chip when a non-collapsed range selection straddles the match', async () => {
    const doc = docWithText('see @1 here')
    const decorations = await decorationsForDoc(
      doc,
      'view',
      TextSelection.create(doc, 4, 8),
    )

    expect(decorations).toEqual([])
  })

  it('only suppresses the match under the selection, leaving other matches in the same paragraph as chips', async () => {
    const doc = docWithText('see @1 and @2 here')
    const decorations = await decorationsForDoc(
      doc,
      'view',
      TextSelection.create(doc, 6),
    )

    expect(normalize(decorations)).toEqual([
      {
        from: 12,
        to: 12,
        spec: { key: 'fake:@2:12', side: 1, data: { n: 2 }, raw: '@2' },
      },
      { from: 12, to: 14, spec: {} },
    ])
  })

  it('suppresses the card and shows the raw source when the selection overlaps the reference paragraph', async () => {
    const doc = docWithParagraphs('@1', 'x')
    const decorations = await decorationsForDoc(
      doc,
      'view',
      Selection.atStart(doc),
    )

    expect(decorations).toEqual([])
  })

  // A freshly mounted view's selection defaults to the doc start before the
  // user has focused it, which would otherwise suppress whatever reference
  // sits there — see the `hasFocus()` check in createInlineReferencePlugin.
  it('does not suppress a card whose paragraph the selection overlaps when the view lacks focus', async () => {
    const doc = docWithParagraphs('@1', 'x')
    const decorations = await decorationsForDoc(
      doc,
      'view',
      Selection.atStart(doc),
      false,
    )

    expect(normalize(decorations)).toEqual([
      {
        from: 1,
        to: 1,
        spec: { key: 'fake:card:@1:1', side: 1, data: { n: 1 }, raw: '@1' },
      },
      { from: 1, to: 3, spec: {} },
    ])
  })

  // ProseMirror's blur/focus handling never dispatches a transaction on its
  // own, so without this listener a match's suppressed/shown state could get
  // stuck past the focus change that should have flipped it.
  it('dispatches a no-op transaction to force decorations to re-run when focus changes', async () => {
    const plugin = await buildPlugin('view')
    const { view, dom, dispatch } = fakeDispatchableEditorView()

    plugin.spec.view?.(view)
    dom.dispatchEvent(new FocusEvent('focus'))
    dom.dispatchEvent(new FocusEvent('blur'))

    expect(dispatch).toHaveBeenCalledTimes(2)
  })

  it('stops redecorating on focus change once the plugin view is destroyed', async () => {
    const plugin = await buildPlugin('view')
    const { view, dom, dispatch } = fakeDispatchableEditorView()

    const pluginView = plugin.spec.view?.(view)
    pluginView?.destroy?.()
    dom.dispatchEvent(new FocusEvent('blur'))

    expect(dispatch).not.toHaveBeenCalled()
  })
})
