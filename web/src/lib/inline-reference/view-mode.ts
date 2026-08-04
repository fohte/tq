export type InlineReferenceViewMode = 'view' | 'edit'

export interface InlineReferenceViewModeStore {
  getMode: () => InlineReferenceViewMode
  setMode: (mode: InlineReferenceViewMode) => void
}

// One store per editor instance (created alongside its Crepe instance in
// markdown-editor.tsx): multiple MarkdownEditor instances can be mounted at
// once (e.g. one per comment), and their view/edit mode must not leak into
// each other.
//
// This intentionally lives outside ProseMirror state/plugins. Mode is
// UI-only, not document content — reading it straight from a mutable ref
// (instead of routing it through a dispatched transaction) means switching
// modes never dispatches a transaction at all, so it can't accidentally give
// other plugins' `appendTransaction` hooks (e.g. `@milkdown/plugin-trailing`)
// a chance to mutate the document as a side effect. `crepe.setReadonly()`
// already calls `view.setProps()` on every mode change, which is enough on
// its own to make ProseMirror recompute decorations (`decorations(state)`
// runs on every `setProps`/`dispatch`, not just on a new transaction).
export function createInlineReferenceViewModeStore(
  initialMode: InlineReferenceViewMode,
): InlineReferenceViewModeStore {
  let mode = initialMode
  return {
    getMode: () => mode,
    setMode: (next) => {
      mode = next
    },
  }
}
