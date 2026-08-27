import type { Node } from '@milkdown/kit/prose/model'
import type { EditorState } from '@milkdown/kit/prose/state'
import {
  NodeSelection,
  Plugin,
  PluginKey,
  TextSelection,
} from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'
import { $prose } from '@milkdown/kit/utils'
import type { CreateReactWidgetView } from '@prosemirror-adapter/react'
import { useWidgetViewContext } from '@prosemirror-adapter/react'

import { ImageSourceText } from '#components/ui/image-source-text'
import type {
  ImageAttrs,
  ImageBlockAttrs,
} from '#lib/image-source-reveal/markdown'
import {
  imageAttrsToText,
  imageBlockAttrsToText,
  textToImageAttrs,
  textToImageBlockAttrs,
} from '#lib/image-source-reveal/markdown'
import type { InlineReferenceViewModeStore } from '#lib/inline-reference/view-mode'

function nodeToText(node: Node): string {
  return node.type.name === 'image-block'
    ? // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- attrs shape is fixed by @milkdown/components' image-block schema
      imageBlockAttrsToText(node.attrs as ImageBlockAttrs)
    : // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- attrs shape is fixed by @milkdown/preset-commonmark's image schema
      imageAttrsToText(node.attrs as ImageAttrs)
}

function textToAttrs(nodeType: string, text: string): Node['attrs'] | null {
  return nodeType === 'image-block'
    ? textToImageBlockAttrs(text)
    : textToImageAttrs(text)
}

// A block image node (isolating, atom) never has a text cursor inside it, so
// "the cursor is on its line" means the selection sits at one of its two
// boundary positions, or the node itself is NodeSelection-ed by a click.
// An inline image instead lives inside a paragraph alongside real text, so
// "its line" is the whole paragraph the selection is in.
function isCursorOnImageLine(
  state: EditorState,
  pos: number,
  node: Node,
): boolean {
  const { selection } = state

  if (node.type.name === 'image-block') {
    if (selection instanceof NodeSelection && selection.from === pos)
      return true
    const nodeEnd = pos + node.nodeSize
    return (
      selection.empty && (selection.from === pos || selection.from === nodeEnd)
    )
  }

  const $pos = state.doc.resolve(pos)
  return selection.from >= $pos.start() && selection.to <= $pos.end()
}

// Bridges ProseMirror's view/node model to the presentational
// ImageSourceText component: resolves the current node fresh on every
// commit (rather than closing over the node the widget was created with),
// since the node's attrs change as the user edits.
function ImageSourceWidget() {
  const { view, getPos } = useWidgetViewContext()

  function resolveCurrent(): { pos: number; node: Node } | null {
    const pos = getPos()
    const node = pos != null ? view.state.doc.nodeAt(pos) : null
    return pos != null && node != null ? { pos, node } : null
  }

  const current = resolveCurrent()
  if (current == null) return null

  function commit(text: string) {
    const current = resolveCurrent()
    if (current == null) return
    const attrs = textToAttrs(current.node.type.name, text)
    if (attrs == null) {
      console.error('Failed to parse image markdown', text)
      return
    }
    view.dispatch(view.state.tr.setNodeMarkup(current.pos, undefined, attrs))
  }

  function commitAndMoveOut(text: string) {
    commit(text)
    const current = resolveCurrent()
    if (current == null) return
    const after = view.state.doc.resolve(current.pos + current.node.nodeSize)
    view.dispatch(view.state.tr.setSelection(TextSelection.near(after)))
    view.focus()
  }

  return (
    <ImageSourceText
      initialText={nodeToText(current.node)}
      editable={view.editable}
      onCommit={commit}
      onCommitAndMoveOut={commitAndMoveOut}
    />
  )
}

// Reveals an image/image-block node as editable raw Markdown while the
// cursor is on its line, and renders it back to an image once the cursor
// moves away — the image-node counterpart to inline-reference/plugin.tsx's
// chip reveal. Unlike that plugin, the raw text isn't already in the doc
// (image/image-block are atom nodes), so it's reconstructed from the node's
// attrs (see markdown.ts) rather than just un-hidden. Gated on the same
// `viewModeStore` (see view-mode.ts) as the other plugins at this call site:
// without it, a document whose default selection lands on a leading image
// (ProseMirror's initial selection is Selection.atStart(doc)) would reveal
// raw Markdown even in read-only view mode.
export function createImageSourceRevealPlugin(
  widgetViewFactory: CreateReactWidgetView,
  viewModeStore: InlineReferenceViewModeStore,
) {
  const createInlineWidget = widgetViewFactory({
    as: 'span',
    component: ImageSourceWidget,
  })
  const createBlockWidget = widgetViewFactory({
    as: 'div',
    component: ImageSourceWidget,
  })

  return $prose(() => {
    return new Plugin({
      key: new PluginKey('image-source-reveal'),
      props: {
        decorations(state) {
          if (viewModeStore.getMode() !== 'edit') return DecorationSet.empty

          const decorations: Decoration[] = []
          state.doc.descendants((node, pos) => {
            if (node.type.name !== 'image' && node.type.name !== 'image-block')
              return
            if (!isCursorOnImageLine(state, pos, node)) return

            const createWidget =
              node.type.name === 'image-block'
                ? createBlockWidget
                : createInlineWidget
            decorations.push(
              Decoration.node(pos, pos + node.nodeSize, {
                class: 'image-source-active',
              }),
              createWidget(pos, {
                key: `image-source:${String(pos)}`,
                side: -1,
              }),
            )
          })
          return DecorationSet.create(state.doc, decorations)
        },
      },
    })
  })
}
