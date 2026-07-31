import type { EditorState, Transaction } from '@milkdown/kit/prose/state'
import { Plugin, PluginKey } from '@milkdown/kit/prose/state'
import type { EditorView } from '@milkdown/kit/prose/view'
import { $prose } from '@milkdown/kit/utils'

export type InlineReferenceViewMode = 'view' | 'edit'

// Shared across every createInlineReferencePlugin instance (one per
// provider): a single dispatchInlineReferenceViewMode call updates them all
// together, since decorations only render in 'view' mode.
export const inlineReferenceViewModeKey =
  new PluginKey<InlineReferenceViewMode>('inline-reference-view-mode')

export function createInlineReferenceViewModePlugin(
  initialMode: InlineReferenceViewMode,
) {
  return $prose(
    () =>
      new Plugin({
        key: inlineReferenceViewModeKey,
        state: {
          init: () => initialMode,
          apply: (tr: Transaction, value: InlineReferenceViewMode) =>
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- only dispatchInlineReferenceViewMode below ever sets this meta key, always with an InlineReferenceViewMode
            (tr.getMeta(inlineReferenceViewModeKey) as
              InlineReferenceViewMode | undefined) ?? value,
        },
      }),
  )
}

export function getInlineReferenceViewMode(
  state: EditorState,
): InlineReferenceViewMode {
  return inlineReferenceViewModeKey.getState(state) ?? 'edit'
}

export function dispatchInlineReferenceViewMode(
  view: EditorView,
  mode: InlineReferenceViewMode,
) {
  view.dispatch(view.state.tr.setMeta(inlineReferenceViewModeKey, mode))
}
