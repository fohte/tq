import type { Ctx } from '@milkdown/kit/ctx'
import { Schema } from '@milkdown/kit/prose/model'

import {
  createInlineReferenceViewModePlugin,
  type InlineReferenceViewMode,
} from '#lib/inline-reference/view-mode'

export const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: {
      content: 'inline*',
      group: 'block',
      toDOM: () => ['p', 0],
    },
    heading: { content: 'inline*', group: 'block' },
    text: { group: 'inline' },
  },
  marks: {},
})

// `$prose`-wrapped plugins (both `createInlineReferencePlugin` and
// `createInlineReferenceViewModePlugin`) need a real `Ctx` to resolve schema
// timing and register the plugin, but the wrapped callbacks themselves never
// read `ctx`, so a stub satisfying only the two methods `$prose` calls is
// enough to unwrap the underlying `Plugin`.
// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- stub only exercises .wait/.update, see comment above
export const fakeCtx = {
  wait: async () => {},
  update: () => {},
} as unknown as Ctx

export async function buildModePlugin(mode: InlineReferenceViewMode) {
  const wrapped = createInlineReferenceViewModePlugin(mode)
  await wrapped(fakeCtx)()
  return wrapped.plugin()
}
