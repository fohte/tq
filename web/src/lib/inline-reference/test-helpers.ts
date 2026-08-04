import type { Ctx } from '@milkdown/kit/ctx'
import { Schema } from '@milkdown/kit/prose/model'

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

// `createInlineReferencePlugin` ($prose-wrapped) needs a real `Ctx` to
// resolve schema timing and register the plugin, but the wrapped callback
// itself never reads `ctx`, so a stub satisfying only the two methods
// `$prose` calls is enough to unwrap the underlying `Plugin`.
// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- stub only exercises .wait/.update, see comment above
export const fakeCtx = {
  wait: async () => {},
  update: () => {},
} as unknown as Ctx
