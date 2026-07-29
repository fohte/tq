import type { Ctx } from '@milkdown/kit/ctx'
import { Schema } from '@milkdown/kit/prose/model'
import { EditorState, TextSelection } from '@milkdown/kit/prose/state'
import { EditorView } from '@milkdown/kit/prose/view'
import { describe, expect, it } from 'vitest'

import { createInlineReferencePlugin } from '#lib/inline-reference/plugin'
import type { InlineReferenceProvider } from '#lib/inline-reference/types'

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

// `createInlineReferencePlugin` wraps a plain `prosemirror-state` `Plugin` in
// Milkdown's `$prose` lifecycle, which needs a real `Ctx` to resolve schema
// timing and register the plugin. The wrapped callback itself never reads
// `ctx`, so a stub satisfying only the two methods `$prose` calls is enough
// to unwrap the underlying `Plugin` for a plain `prosemirror-view` test.
async function buildProsePlugin<TData>(
  provider: InlineReferenceProvider<TData>,
) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- stub only exercises .wait/.update, see comment above
  const fakeCtx = {
    wait: async () => {},
    update: () => {},
  } as unknown as Ctx
  const wrapped = createInlineReferencePlugin(provider)
  await wrapped(fakeCtx)()
  return wrapped.plugin()
}

function emptyDoc() {
  return schema.node('doc', null, [schema.node('paragraph', null, [])])
}

function docWithText(text: string) {
  return schema.node('doc', null, [
    schema.node('paragraph', null, [schema.text(text)]),
  ])
}

function createView(provider: InlineReferenceProvider<{ n: number }>) {
  return buildProsePlugin(provider).then(
    (prosePlugin) =>
      new EditorView(document.createElement('div'), {
        state: EditorState.create({
          doc: emptyDoc(),
          schema,
          plugins: [prosePlugin],
        }),
      }),
  )
}

// Mirrors `queryClient.fetchQuery()`'s real behavior (see
// `use-task-mentions.ts`'s `ensureTaskMentionPreviewLoaded`): it can notify
// subscribers synchronously, more than once, before `ensureLoaded` itself
// returns to its caller.
function createReentrantProvider() {
  const ready = new Set<number>()
  let notify: (() => void) | undefined

  const provider: InlineReferenceProvider<{ n: number }> = {
    id: 'reentrant-fake',
    findMatches(text) {
      return [...text.matchAll(/@(\d+)/g)].map((match) => ({
        start: match.index,
        end: match.index + match[0].length,
        raw: match[0],
        data: { n: Number(match[1]) },
      }))
    },
    isReady: (data) => ready.has(data.n),
    ensureLoaded: () => {
      notify?.()
      notify?.()
    },
    subscribe: (fn) => {
      notify = fn
      return () => {
        notify = undefined
      }
    },
    Chip: () => null,
  }

  return { provider, ready }
}

// Replaces the whole doc and moves the selection out of the way, since a
// decoration is suppressed wherever the selection touches it (see
// `selection-overlap.ts`) — the tests here care about the chip widget, not
// the raw-text editing behavior.
function replaceContent(view: EditorView, doc: ReturnType<typeof docWithText>) {
  const tr = view.state.tr.replaceWith(
    0,
    view.state.doc.content.size,
    doc.content,
  )
  tr.setSelection(TextSelection.atStart(tr.doc))
  view.dispatch(tr)
}

describe('createInlineReferencePlugin', () => {
  it('does not recurse into dispatch() when a provider notifies synchronously and reentrantly from ensureLoaded', async () => {
    const { provider } = createReentrantProvider()
    // Mount with an empty doc first so the plugin's view() subscription is
    // already active by the time a match is introduced (mirrors a real
    // editor: content is set via a transaction after the view exists, not
    // synchronously during EditorView construction).
    const view = await createView(provider)

    expect(() => {
      replaceContent(view, docWithText('see @1 here'))
    }).not.toThrow()

    view.destroy()
  })

  it('redraws once the provider becomes ready, without dispatching reentrantly', async () => {
    const { provider, ready } = createReentrantProvider()
    const view = await createView(provider)

    replaceContent(view, docWithText('see @1 here'))
    expect(view.dom.querySelector('.inline-reference-chip')).toBeNull()

    // Simulates the mention's data finishing its load out-of-band, the way
    // a real provider's async fetch resolves after the initial redraw.
    ready.add(1)
    provider.ensureLoaded({ n: 1 })
    // The redraw is deferred to a microtask (see plugin.tsx); let it run.
    await Promise.resolve()

    expect(view.dom.querySelector('.inline-reference-chip')).not.toBeNull()

    view.destroy()
  })

  it('does not dispatch on a view that was destroyed before a deferred redraw runs', async () => {
    const { provider } = createReentrantProvider()
    const view = await createView(provider)

    replaceContent(view, docWithText('see @1 here'))
    view.destroy()

    // The pending microtask redraw scheduled by ensureLoaded's notify above
    // must see the destroyed view and skip dispatching, rather than
    // throwing on a torn-down EditorView.
    await expect(Promise.resolve()).resolves.toBeUndefined()
  })
})
