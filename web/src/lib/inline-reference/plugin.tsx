import type { Node } from '@milkdown/kit/prose/model'
import { Plugin, PluginKey } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'
import { $prose } from '@milkdown/kit/utils'
import type {
  CreateReactWidgetView,
  ReactWidgetViewComponent,
} from '@prosemirror-adapter/react'
import { useWidgetViewContext } from '@prosemirror-adapter/react'
import { useEffect, useRef } from 'react'

import { rangeTouchesSelection } from '#lib/inline-reference/selection-overlap'
import { collectTextBlockRuns } from '#lib/inline-reference/text-scan'
import type { InlineReferenceProvider } from '#lib/inline-reference/types'

function buildDecorations<TData>(
  provider: InlineReferenceProvider<TData>,
  createWidget: ReturnType<CreateReactWidgetView>,
  doc: Node,
  selectionFrom: number,
  selectionTo: number,
): Decoration[] {
  const decorations: Decoration[] = []

  for (const run of collectTextBlockRuns(doc)) {
    for (const match of provider.findMatches(run.text)) {
      const from = run.posAt(match.start)
      const to = run.posAt(match.end)

      if (rangeTouchesSelection(selectionFrom, selectionTo, from, to)) continue

      decorations.push(
        Decoration.inline(from, to, { class: 'inline-reference-source' }),
        createWidget(from, {
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

    useEffect(() => {
      const container = containerRef.current
      if (container == null) return

      // The raw source text this chip covers is hidden but still in the doc
      // (see the .inline-reference-source CSS), so it can still carry marks
      // like `link`. Milkdown's own link-hover-preview plugin resolves mouse
      // coordinates to a doc position via `posAtCoords` on every mousemove
      // bubbling up to the ProseMirror view, and shows its own tooltip for
      // any mark it finds there — including this chip's hidden source.
      // Stopping propagation here keeps that plugin-internal (and any
      // similar mark-driven) mousemove handling from ever seeing the event.
      // This has to be a real DOM listener rather than a React one: React's
      // synthetic events are delegated from the app's root DOM node, which
      // sits above the ProseMirror view in the tree, so by the time a
      // synthetic handler could call stopPropagation() the native event has
      // already bubbled past the view's own listener.
      const stopPropagation = (event: Event) => {
        event.stopPropagation()
      }
      container.addEventListener('mousemove', stopPropagation)
      container.addEventListener('mouseleave', stopPropagation)
      return () => {
        container.removeEventListener('mousemove', stopPropagation)
        container.removeEventListener('mouseleave', stopPropagation)
      }
    }, [])

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- data/raw travel through the widget decoration spec's untyped `[key: string]: any` bag; this cast documents the shape createWidget() above always gives it
    const { data, raw } = spec as { data: TData; raw: string }

    return (
      <span ref={containerRef} className="inline-reference-chip">
        <provider.Chip data={data} raw={raw} />
      </span>
    )
  }
}

// Wires one InlineReferenceProvider up as a Milkdown/ProseMirror plugin: text
// matching its pattern is hidden and replaced by the provider's chip widget,
// except where the selection touches it (so it stays plain, editable text).
// `widgetViewFactory` comes from @prosemirror-adapter/react's
// useWidgetViewFactory(), so this must be called from within a component
// tree that has a ProsemirrorAdapterProvider ancestor.
export function createInlineReferencePlugin<TData>(
  provider: InlineReferenceProvider<TData>,
  widgetViewFactory: CreateReactWidgetView,
) {
  const createWidget = widgetViewFactory({
    as: 'span',
    component: createChipWidgetComponent(provider),
  })

  return $prose(() => {
    return new Plugin({
      key: new PluginKey(`inline-reference-${provider.id}`),
      props: {
        decorations(state) {
          const { doc, selection } = state
          return DecorationSet.create(
            doc,
            buildDecorations(
              provider,
              createWidget,
              doc,
              selection.from,
              selection.to,
            ),
          )
        },
      },
    })
  })
}
