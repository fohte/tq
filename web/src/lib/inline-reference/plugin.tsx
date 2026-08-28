import type { Node } from '@milkdown/kit/prose/model'
import type { Selection } from '@milkdown/kit/prose/state'
import { Plugin, PluginKey } from '@milkdown/kit/prose/state'
import type { EditorView } from '@milkdown/kit/prose/view'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'
import { $prose } from '@milkdown/kit/utils'
import type {
  CreateReactWidgetView,
  ReactWidgetViewComponent,
} from '@prosemirror-adapter/react'
import { useWidgetViewContext } from '@prosemirror-adapter/react'
import type { RefObject } from 'react'
import { useEffect, useRef } from 'react'

import { collectTextBlockRuns } from '#lib/inline-reference/text-scan'
import type { InlineReferenceProvider } from '#lib/inline-reference/types'
import type { InlineReferenceViewModeStore } from '#lib/inline-reference/view-mode'

// The cursor (or either edge of a range selection) touching a match's range
// at all — including sitting exactly on `from`/`to` — counts as "on" it, so
// typing right before/after the raw text doesn't still show a chip.
// `selection` is null when the editor doesn't have focus: a freshly mounted
// view's selection defaults to the doc start, which would otherwise suppress
// whatever reference sits there before the user has touched anything.
function selectionOverlaps(
  selection: Selection | null,
  from: number,
  to: number,
) {
  if (selection == null) return false
  return selection.to >= from && selection.from <= to
}

function buildDecorations<TData>(
  provider: InlineReferenceProvider<TData>,
  createChipWidget: ReturnType<CreateReactWidgetView>,
  createCardWidget: ReturnType<CreateReactWidgetView>,
  doc: Node,
  selection: Selection | null,
): Decoration[] {
  const decorations: Decoration[] = []

  for (const run of collectTextBlockRuns(doc)) {
    const matches = provider.findMatches(run.text)
    const [soleMatch] = matches

    // A paragraph whose entire (trimmed) text is exactly one match is that
    // reference's own paragraph: render it as a full-width card instead of an
    // inline chip.
    if (
      run.nodeType === 'paragraph' &&
      matches.length === 1 &&
      soleMatch != null &&
      soleMatch.raw === run.text.trim()
    ) {
      const hideFrom = run.posAt(0)
      const hideTo = run.posAt(run.text.length)
      if (selectionOverlaps(selection, hideFrom, hideTo)) continue

      const from = run.posAt(soleMatch.start)
      decorations.push(
        Decoration.inline(hideFrom, hideTo, {
          class: 'inline-reference-source',
        }),
        createCardWidget(from, {
          key: `${provider.id}:card:${soleMatch.raw}:${String(from)}`,
          side: 1,
          data: soleMatch.data,
          raw: soleMatch.raw,
        }),
      )
      continue
    }

    for (const match of matches) {
      const from = run.posAt(match.start)
      const to = run.posAt(match.end)
      if (selectionOverlaps(selection, from, to)) continue

      decorations.push(
        Decoration.inline(from, to, { class: 'inline-reference-source' }),
        createChipWidget(from, {
          key: `${provider.id}:${match.raw}:${String(from)}`,
          side: 1,
          data: match.data,
          raw: match.raw,
        }),
      )
    }
  }

  return decorations
}

// The raw source text a chip/card covers is hidden but still in the doc (see
// the .inline-reference-source CSS), so it can still carry marks like
// `link`. Milkdown's own link-hover-preview plugin resolves mouse coordinates
// to a doc position via `posAtCoords` on every mousemove bubbling up to the
// ProseMirror view, and shows its own tooltip for any mark it finds there —
// including this widget's hidden source. Stopping propagation here keeps
// that plugin-internal (and any similar mark-driven) mousemove handling from
// ever seeing the event. This has to be a real DOM listener rather than a
// React one: React's synthetic events are delegated from the app's root DOM
// node, which sits above the ProseMirror view in the tree, so by the time a
// synthetic handler could call stopPropagation() the native event has
// already bubbled past the view's own listener.
function useStopNativeHoverBubbling(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const container = ref.current
    if (container == null) return
    const stopPropagation = (event: Event) => {
      event.stopPropagation()
    }
    container.addEventListener('mousemove', stopPropagation)
    container.addEventListener('mouseleave', stopPropagation)
    return () => {
      container.removeEventListener('mousemove', stopPropagation)
      container.removeEventListener('mouseleave', stopPropagation)
    }
  }, [ref])
}

// Bound once per provider (not per match): the widget's `data`/`raw` travel
// through the decoration spec instead of component props, since
// @prosemirror-adapter/react's widget component takes no props of its own
// (see useWidgetViewContext below).
function createChipWidgetComponent<TData>(
  provider: InlineReferenceProvider<TData>,
): ReactWidgetViewComponent {
  return function InlineReferenceWidget() {
    const { spec } = useWidgetViewContext()
    const containerRef = useRef<HTMLSpanElement>(null)
    useStopNativeHoverBubbling(containerRef)

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- data/raw travel through the widget decoration spec's untyped `[key: string]: any` bag; this cast documents the shape createChipWidget() above always gives it
    const { data, raw } = spec as { data: TData; raw: string }

    return (
      <span ref={containerRef} className="inline-reference-chip">
        <provider.Chip data={data} raw={raw} />
      </span>
    )
  }
}

// Parallel to createChipWidgetComponent, but renders the provider's block-level
// Card. The wrapper also stops the React synthetic `mouseup` event from
// propagating: MarkdownEditor listens for `mouseup` bubbling up from view-mode
// content to switch into edit mode, and a card's whole point is to stay
// clickable (e.g. its internal links) without ever triggering that switch.
function createCardWidgetComponent<TData>(
  provider: InlineReferenceProvider<TData>,
): ReactWidgetViewComponent {
  return function InlineReferenceCardWidget() {
    const { spec } = useWidgetViewContext()
    const containerRef = useRef<HTMLDivElement>(null)
    useStopNativeHoverBubbling(containerRef)

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- same cast/reason as createChipWidgetComponent above, for createCardWidget()'s spec instead
    const { data, raw } = spec as { data: TData; raw: string }

    return (
      <div
        ref={containerRef}
        className="inline-reference-card"
        onMouseUp={(event) => {
          event.stopPropagation()
        }}
      >
        <provider.Card data={data} raw={raw} />
      </div>
    )
  }
}

// Wires one InlineReferenceProvider up as a Milkdown/ProseMirror plugin: in
// 'view' mode (see view-mode.ts), text matching its pattern is hidden and
// replaced by the provider's chip (or card, see buildDecorations) widget,
// except for a match the selection currently overlaps while the view has
// focus — that one stays as raw, editable source until the selection moves
// off it (selectionOverlaps); in 'edit' mode, decorations are suppressed
// entirely and the raw Markdown source is shown as-is. `widgetViewFactory`
// comes from @prosemirror-adapter/react's useWidgetViewFactory(), so this
// must be called from within a component tree that has a
// ProsemirrorAdapterProvider ancestor. `viewModeStore` is read directly (not
// from ProseMirror state) so that switching modes never needs a transaction
// dispatch — see view-mode.ts.
export function createInlineReferencePlugin<TData>(
  provider: InlineReferenceProvider<TData>,
  widgetViewFactory: CreateReactWidgetView,
  viewModeStore: InlineReferenceViewModeStore,
) {
  const createChipWidget = widgetViewFactory({
    as: 'span',
    component: createChipWidgetComponent(provider),
  })
  const createCardWidget = widgetViewFactory({
    as: 'div',
    component: createCardWidgetComponent(provider),
  })

  return $prose(() => {
    let editorView: EditorView | null = null

    return new Plugin({
      key: new PluginKey(`inline-reference-${provider.id}`),
      // ProseMirror's own focus/blur handling only flips `view.focused`
      // internally — it never dispatches a transaction — so decorations()
      // wouldn't otherwise be re-run when focus changes, leaving a match
      // stuck showing raw source (or a chip) past the focus change that
      // should have flipped it. `setProps({})` re-runs `decorations()`
      // without touching `state`, unlike `dispatch()`, which would also
      // invoke every other plugin's `appendTransaction` (e.g. Milkdown's
      // `trailing` plugin, which appends a paragraph on any transaction —
      // dispatching here would fire it on every focus change).
      view(view) {
        editorView = view
        const redecorate = () => {
          view.setProps({})
        }
        view.dom.addEventListener('focus', redecorate)
        view.dom.addEventListener('blur', redecorate)
        return {
          destroy() {
            view.dom.removeEventListener('focus', redecorate)
            view.dom.removeEventListener('blur', redecorate)
          },
        }
      },
      props: {
        decorations(state) {
          if (viewModeStore.getMode() !== 'view') return DecorationSet.empty
          const { doc, selection } = state
          return DecorationSet.create(
            doc,
            buildDecorations(
              provider,
              createChipWidget,
              createCardWidget,
              doc,
              editorView?.hasFocus() === true ? selection : null,
            ),
          )
        },
      },
    })
  })
}
