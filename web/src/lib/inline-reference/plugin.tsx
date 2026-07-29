import type { Node } from '@milkdown/kit/prose/model'
import { Plugin, PluginKey } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'
import { $prose } from '@milkdown/kit/utils'
import { QueryClientProvider } from '@tanstack/react-query'
import { createRoot, type Root } from 'react-dom/client'

import { rangeTouchesSelection } from '#lib/inline-reference/selection-overlap'
import { collectTextBlockRuns } from '#lib/inline-reference/text-scan'
import type { InlineReferenceProvider } from '#lib/inline-reference/types'
import { queryClient } from '#lib/query-client'

function buildDecorations<TData>(
  provider: InlineReferenceProvider<TData>,
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

      if (!provider.isReady(match.data)) {
        provider.ensureLoaded(match.data)
        continue
      }

      decorations.push(
        Decoration.inline(from, to, { class: 'inline-reference-source' }),
        createChipWidget(provider, match.data, match.raw, from),
      )
    }
  }

  return decorations
}

function createChipWidget<TData>(
  provider: InlineReferenceProvider<TData>,
  data: TData,
  raw: string,
  from: number,
): Decoration {
  let root: Root | undefined

  return Decoration.widget(
    from,
    () => {
      const container = document.createElement('span')
      container.className = 'inline-reference-chip'
      root = createRoot(container)
      root.render(
        <QueryClientProvider client={queryClient}>
          <provider.Chip data={data} />
        </QueryClientProvider>,
      )
      return container
    },
    {
      key: `${provider.id}:${raw}:${String(from)}`,
      side: 1,
      destroy: () => root?.unmount(),
    },
  )
}

// Wires one InlineReferenceProvider up as a Milkdown/ProseMirror plugin: text
// matching its pattern is hidden and replaced by the provider's chip widget,
// except where the selection touches it (so it stays plain, editable text).
export function createInlineReferencePlugin<TData>(
  provider: InlineReferenceProvider<TData>,
) {
  return $prose(() => {
    return new Plugin({
      key: new PluginKey(`inline-reference-${provider.id}`),
      props: {
        decorations(state) {
          const { doc, selection } = state
          return DecorationSet.create(
            doc,
            buildDecorations(provider, doc, selection.from, selection.to),
          )
        },
      },
      view(editorView) {
        // Metadata resolves asynchronously, outside of any ProseMirror
        // transaction, so force a redraw to pick it up once it lands.
        //
        // The redraw is deferred to a microtask rather than dispatched
        // inline: `notify` can fire synchronously and re-entrantly out of
        // `ensureLoaded`'s `queryClient.fetchQuery()` call below (its cache
        // `added`/fetch-start events are emitted before `fetchQuery` itself
        // returns). Dispatching synchronously there would re-enter this same
        // `decorations()` computation from inside itself, unboundedly,
        // overflowing the call stack. A microtask always runs after the
        // current synchronous call stack has fully unwound, so it can never
        // nest inside the call that scheduled it.
        let redrawScheduled = false
        const unsubscribe = provider.subscribe(() => {
          if (redrawScheduled) return
          redrawScheduled = true
          void Promise.resolve().then(() => {
            redrawScheduled = false
            if (editorView.isDestroyed) return
            editorView.dispatch(editorView.state.tr)
          })
        })
        return { destroy: unsubscribe }
      },
    })
  })
}
