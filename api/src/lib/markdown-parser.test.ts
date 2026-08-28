import { describe, expect, it } from 'vitest'

import { parseMarkdown } from '#lib/markdown-parser'

describe('parseMarkdown', () => {
  it('parses markdown into a ProseMirror doc using the commonmark+gfm schema', async () => {
    const doc = await parseMarkdown(
      'hello **#123** [text](https://x.io/76) ~~strike~~ `code`',
    )

    expect(Object.keys(doc.type.schema.marks).sort()).toEqual([
      'emphasis',
      'inlineCode',
      'link',
      'strike_through',
      'strong',
    ])
  })
})
