import type { Ctx } from '@milkdown/kit/ctx'
import { Schema } from '@milkdown/kit/prose/model'
import { EditorState } from '@milkdown/kit/prose/state'
import { EditorView } from '@milkdown/kit/prose/view'
import { describe, expect, it } from 'vitest'

import {
  createInlineReferenceViewModePlugin,
  dispatchInlineReferenceViewMode,
  getInlineReferenceViewMode,
} from '#lib/inline-reference/view-mode'

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

// `createInlineReferenceViewModePlugin` wraps a plain `prosemirror-state`
// `Plugin` in Milkdown's `$prose` lifecycle, which needs a real `Ctx` to
// resolve schema timing and register the plugin. The wrapped callback itself
// never reads `ctx`, so a stub satisfying only the two methods `$prose`
// calls is enough to unwrap the underlying `Plugin`.
// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- stub only exercises .wait/.update, see comment above
const fakeCtx = {
  wait: async () => {},
  update: () => {},
} as unknown as Ctx

async function buildModePlugin(initialMode: 'view' | 'edit') {
  const wrapped = createInlineReferenceViewModePlugin(initialMode)
  await wrapped(fakeCtx)()
  return wrapped.plugin()
}

function emptyDoc() {
  return schema.node('doc', null, [schema.node('paragraph', null, [])])
}

describe('getInlineReferenceViewMode', () => {
  it('returns the plugin initial mode', async () => {
    const modePlugin = await buildModePlugin('view')
    const doc = emptyDoc()
    const state = EditorState.create({ doc, schema, plugins: [modePlugin] })

    expect(getInlineReferenceViewMode(state)).toEqual('view')
  })
})

describe('dispatchInlineReferenceViewMode', () => {
  it('switches the mode read back from the view after dispatch', async () => {
    const modePlugin = await buildModePlugin('view')
    const doc = emptyDoc()
    const state = EditorState.create({ doc, schema, plugins: [modePlugin] })
    const view = new EditorView(document.createElement('div'), { state })

    dispatchInlineReferenceViewMode(view, 'edit')

    expect(getInlineReferenceViewMode(view.state)).toEqual('edit')

    view.destroy()
  })
})
