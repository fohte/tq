import {
  commands,
  config,
  Editor,
  init,
  keymap,
  parser,
  parserCtx,
  pasteRule,
  schema,
} from '@milkdown/kit/core'
import type { MilkdownPlugin } from '@milkdown/kit/ctx'
import { Clock, Container, Ctx } from '@milkdown/kit/ctx'
import { commonmark } from '@milkdown/kit/preset/commonmark'
import { gfm } from '@milkdown/kit/preset/gfm'
import type { Node } from '@milkdown/kit/prose/model'
import { fromThrowable, type Result } from 'neverthrow'

import { BoundaryError } from '#errors'

// milkdown's internal Timer (see @milkdown/ctx) dispatches CustomEvents via
// bare global addEventListener/dispatchEvent, which only exist in a browser
// (where they resolve to window's EventTarget methods). Node has no such
// bare globals even though EventTarget/CustomEvent exist as constructors, so
// route them through a private EventTarget instance.
//
// `api`'s tsconfig has no DOM lib, so `globalThis` isn't typed with these
// event-target members at all — narrowed to `Partial<...>` here (rather than
// direct property assignment) so both the read and the Object.assign below
// typecheck without an `any`.
type GlobalEventTargetMembers = Pick<
  EventTarget,
  'addEventListener' | 'removeEventListener' | 'dispatchEvent'
>
// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- `globalThis`'s type has no event-target members without a DOM lib; this cast only reads/writes the three members polyfilled below, and is undone by the `typeof ... === 'function'` runtime check
const globalEventTarget = globalThis as Partial<GlobalEventTargetMembers>
if (typeof globalEventTarget.dispatchEvent !== 'function') {
  const target = new EventTarget()
  Object.assign(globalThis, {
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    dispatchEvent: target.dispatchEvent.bind(target),
  })
}

// milkdown's remark-based parser throws (e.g. `RangeError: Maximum call
// stack size exceeded` on deeply nested input such as thousands of nested
// blockquotes) rather than returning a Result, so `parseMarkdown` wraps it
// at this interop boundary instead of letting it escape as an uncaught
// exception.
export class MarkdownParseError extends BoundaryError {}

let ctxPromise: Promise<Ctx> | undefined

// Drives milkdown's plugin system with only the DOM-free internal plugins
// needed to build a working `parserCtx` (schema + commonmark/gfm parsing
// rules), skipping `editorState`/`editorView`/`serializer`, which touch
// `document` and would throw outside a browser. Memoized: building the
// ctx/plugin chain is stateless once done, so it only needs to happen once
// per process, lazily on first call.
async function getCtx(): Promise<Ctx> {
  if (ctxPromise == null) {
    ctxPromise = (async () => {
      const ctx = new Ctx(new Container(), new Clock())
      const plugins: MilkdownPlugin[] = [
        schema,
        parser,
        commands,
        keymap,
        pasteRule,
        init(Editor.make()), // editorCtx is injected but never read; Editor.make() just satisfies the type, .create() is never called so no DOM is touched
        config(() => undefined),
        ...commonmark,
        ...gfm,
      ]
      // Two phases, matching @milkdown/core's own Editor#create: registering
      // every plugin's slices/timers (the synchronous `plugin(ctx)` call)
      // must finish for *all* plugins before any plugin's async setup runs,
      // since e.g. `schema`'s setup synchronously waits on a timer that
      // `init`'s setup only registers during its own `plugin(ctx)` call —
      // interleaving the two phases per-plugin throws "Timer ... not found"
      // for whichever plugin sorts before the one registering its timer.
      const handlers = plugins.map((plugin) => plugin(ctx))
      await Promise.all(
        handlers.map(async (handler) => {
          await handler()
        }),
      )
      return ctx
    })()
  }
  return ctxPromise
}

// Parses markdown into the same ProseMirror `Node` shape the frontend
// editor (Crepe, commonmark+gfm presets) produces, so `collectTextBlockRuns`
// can run identically on both sides. `ctx.get(parserCtx)` is a synchronous,
// stateless function (see @milkdown/transformer's `ParserState.create`), so
// it's safe to call repeatedly/concurrently once the ctx is built.
export async function parseMarkdown(
  markdown: string,
): Promise<Result<Node, MarkdownParseError>> {
  const ctx = await getCtx()
  const parse = fromThrowable(
    ctx.get(parserCtx),
    (cause) => new MarkdownParseError('failed to parse markdown', cause),
  )
  return parse(markdown)
}
