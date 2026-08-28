import { Crepe } from '@milkdown/crepe'
import { schemaCtx } from '@milkdown/kit/core'
import { parseMarkdown } from 'api/lib/markdown-parser'
import { describe, expect, it } from 'vitest'

// `collectTextBlockRuns` (shared via the `api` package, see #lib/text-scan
// under api/src/lib) masks text purely by inspecting ProseMirror mark types,
// so its result on the frontend (Crepe's real editor schema) and the backend
// (`parseMarkdown`'s headless commonmark+gfm schema) only agree as long as
// both schemas define the same set of marks. This test builds a real Crepe
// instance rather than hardcoding its mark list a second time, so a future
// change to either side's plugin config that drops or adds a mark fails this
// test instead of silently drifting.
describe('frontend/backend markdown parser schema parity', () => {
  it('has the same mark type names on both sides', async () => {
    const crepe = new Crepe({ root: document.createElement('div') })
    const editor = await crepe.create()
    try {
      const crepeMarks = Object.keys(editor.ctx.get(schemaCtx).marks).sort()

      const doc = await parseMarkdown('')
      const apiMarks = Object.keys(doc.type.schema.marks).sort()

      expect(crepeMarks).toEqual(apiMarks)
    } finally {
      await crepe.destroy()
    }
  })
})
