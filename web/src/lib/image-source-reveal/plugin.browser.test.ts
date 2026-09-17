import type { Ctx } from '@milkdown/kit/ctx'
import { GapCursor } from '@milkdown/kit/prose/gapcursor'
import { Schema } from '@milkdown/kit/prose/model'
import {
  EditorState,
  NodeSelection,
  TextSelection,
} from '@milkdown/kit/prose/state'
import type { DecorationAttrs } from '@milkdown/kit/prose/view'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'
import type { CreateReactWidgetView } from '@prosemirror-adapter/react'
import { describe, expect, it } from 'vitest'

import { createImageSourceRevealPlugin } from '#lib/image-source-reveal/plugin'
import { createInlineReferenceViewModeStore } from '#lib/inline-reference/view-mode'

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { content: 'inline*', group: 'block', toDOM: () => ['p', 0] },
    image: {
      inline: true,
      group: 'inline',
      atom: true,
      attrs: {
        src: { default: '' },
        alt: { default: '' },
        title: { default: '' },
      },
      toDOM: (node) => ['img', node.attrs],
    },
    'image-block': {
      group: 'block',
      atom: true,
      isolating: true,
      attrs: {
        src: { default: '' },
        caption: { default: '' },
        ratio: { default: 1 },
      },
      toDOM: (node) => ['div', node.attrs],
    },
    text: { group: 'inline' },
  },
  marks: {},
})

// createImageSourceRevealPlugin ($prose-wrapped) needs a real `Ctx` to resolve
// schema timing and register the plugin, but the wrapped callback itself
// never reads `ctx`, so a stub satisfying only the two methods `$prose`
// calls is enough to unwrap the underlying `Plugin`.
// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- stub only exercises .wait/.update, see comment above
const fakeCtx = {
  wait: async () => {},
  update: () => {},
} as unknown as Ctx

// This file only exercises the plugin's own decoration wiring (which
// nodes are considered "on the cursor's line" and get hidden/widget-ed).
// Actually rendering a widget as a React portal is
// @prosemirror-adapter/react's own tested responsibility, so this fake
// factory skips it and just returns a Decoration carrying the spec it was
// given, the same shape the real widgetViewFactory produces.
function fakeWidgetViewFactory(): CreateReactWidgetView {
  return () => (pos, spec) =>
    Decoration.widget(pos, () => document.createElement('span'), spec)
}

async function buildPlugin(mode: 'view' | 'edit') {
  const viewModeStore = createInlineReferenceViewModeStore(mode)
  const wrapped = createImageSourceRevealPlugin(
    fakeWidgetViewFactory(),
    viewModeStore,
  )
  await wrapped(fakeCtx)()
  return wrapped.plugin()
}

async function decorationsFor(
  doc: ReturnType<typeof schema.node>,
  selection: EditorState['selection'],
  mode: 'view' | 'edit' = 'edit',
) {
  const plugin = await buildPlugin(mode)
  const state = EditorState.create({ doc, schema, selection })

  const decorationsProp = plugin.props.decorations
  if (decorationsProp == null)
    throw new Error('plugin always defines decorations')
  const source = decorationsProp.call(plugin, state)
  if (!(source instanceof DecorationSet))
    throw new Error('plugin always builds decorations via DecorationSet.create')
  return source.find()
}

// Reduces a Decoration to the fields these tests assert on. `attrs` reads
// the DOM attrs a node decoration applies (see Decoration.node in
// prosemirror-view/src/decoration.ts) — the mechanism markdown-editor.css's
// `.image-source-active` selector relies on to hide the rendered image —
// which the public `DecorationType` interface doesn't expose, hence the
// cast. `spec` is the separate, unrelated 4th constructor argument.
function normalize(decorations: readonly Decoration[]) {
  return decorations
    .map((d) => ({
      from: d.from,
      to: d.to,
      spec: d.spec as unknown,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- DecorationType's public type omits `attrs`, but Decoration.node's underlying NodeType always carries it
      attrs: (d as unknown as { type: { attrs?: DecorationAttrs } }).type.attrs,
    }))
    .sort((a, b) => a.from - b.from || a.to - b.to)
}

describe('createImageSourceRevealPlugin', () => {
  describe('inline image', () => {
    function docWithInlineImage() {
      return schema.node('doc', null, [
        schema.node('paragraph', null, [
          schema.text('a'),
          schema.node('image', { src: 'x.png', alt: 'y', title: '' }),
          schema.text('b'),
        ]),
        schema.node('paragraph', null, [schema.text('c')]),
      ])
    }

    it('reveals the image when the cursor is in its paragraph', async () => {
      const doc = docWithInlineImage()
      const selection = TextSelection.near(doc.resolve(2))
      const decorations = await decorationsFor(doc, selection)

      expect(normalize(decorations)).toEqual([
        {
          from: 2,
          to: 2,
          spec: { key: 'image-source:2', side: -1 },
          attrs: undefined,
        },
        {
          from: 2,
          to: 3,
          spec: {},
          attrs: { class: 'image-source-active' },
        },
      ])
    })

    it('does not reveal the image when the cursor is in a different paragraph', async () => {
      const doc = docWithInlineImage()
      const selection = TextSelection.near(doc.resolve(6))
      const decorations = await decorationsFor(doc, selection)

      expect(decorations).toEqual([])
    })

    it('produces no decorations in view mode', async () => {
      const doc = docWithInlineImage()
      const selection = TextSelection.near(doc.resolve(2))
      const decorations = await decorationsFor(doc, selection, 'view')

      expect(decorations).toEqual([])
    })
  })

  describe('image-block', () => {
    function docWithImageBlock() {
      return schema.node('doc', null, [
        schema.node('paragraph', null, [schema.text('a')]),
        schema.node('image-block', { src: 'x.png', caption: 'y', ratio: 1 }),
        schema.node('paragraph', null, [schema.text('b')]),
      ])
    }

    it('reveals the image when it is NodeSelection-ed (clicked)', async () => {
      const doc = docWithImageBlock()
      const selection = NodeSelection.create(doc, 3)
      const decorations = await decorationsFor(doc, selection)

      expect(normalize(decorations)).toEqual([
        {
          from: 3,
          to: 3,
          spec: { key: 'image-source:3', side: -1 },
          attrs: undefined,
        },
        {
          from: 3,
          to: 4,
          spec: {},
          attrs: { class: 'image-source-active' },
        },
      ])
    })

    it('reveals the image when the cursor sits right before it', async () => {
      const doc = docWithImageBlock()
      const selection = new GapCursor(doc.resolve(3))
      const decorations = await decorationsFor(doc, selection)

      expect(normalize(decorations)).toEqual([
        {
          from: 3,
          to: 3,
          spec: { key: 'image-source:3', side: -1 },
          attrs: undefined,
        },
        {
          from: 3,
          to: 4,
          spec: {},
          attrs: { class: 'image-source-active' },
        },
      ])
    })

    it('reveals the image when the cursor sits right after it', async () => {
      const doc = docWithImageBlock()
      const selection = new GapCursor(doc.resolve(4))
      const decorations = await decorationsFor(doc, selection)

      expect(normalize(decorations)).toEqual([
        {
          from: 3,
          to: 3,
          spec: { key: 'image-source:3', side: -1 },
          attrs: undefined,
        },
        {
          from: 3,
          to: 4,
          spec: {},
          attrs: { class: 'image-source-active' },
        },
      ])
    })

    it('does not reveal the image when the cursor is elsewhere', async () => {
      const doc = docWithImageBlock()
      const selection = TextSelection.near(doc.resolve(1))
      const decorations = await decorationsFor(doc, selection)

      expect(decorations).toEqual([])
    })

    it('produces no decorations in view mode', async () => {
      const doc = docWithImageBlock()
      const selection = NodeSelection.create(doc, 3)
      const decorations = await decorationsFor(doc, selection, 'view')

      expect(decorations).toEqual([])
    })
  })
})
