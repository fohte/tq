import { EditorState } from '@milkdown/kit/prose/state'
import { EditorView } from '@milkdown/kit/prose/view'
import { describe, expect, it } from 'vitest'

import { buildModePlugin, schema } from '#lib/inline-reference/test-helpers'
import {
  dispatchInlineReferenceViewMode,
  getInlineReferenceViewMode,
} from '#lib/inline-reference/view-mode'

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

  it('falls back to edit mode when the plugin is not registered', () => {
    const doc = emptyDoc()
    const state = EditorState.create({ doc, schema })

    expect(getInlineReferenceViewMode(state)).toEqual('edit')
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
