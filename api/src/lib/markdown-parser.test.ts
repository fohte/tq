import type { Node } from '@milkdown/kit/prose/model'
import { describe, expect, it } from 'vitest'

import { MarkdownParseError, parseMarkdown } from '#lib/markdown-parser'

// Mirrors how #lib/text-scan reads a mark's type name and (for a link) its
// `href` attr — the shape callers of parseMarkdown actually rely on, rather
// than the full ProseMirror JSON (which also carries implementation-detail
// attrs, e.g. strong's markdown `marker`).
function describeTextNode(node: Node) {
  return {
    text: node.text,
    marks: node.marks.map((mark) =>
      mark.type.name === 'link' && typeof mark.attrs['href'] === 'string'
        ? { type: mark.type.name, href: mark.attrs['href'] }
        : { type: mark.type.name },
    ),
  }
}

function describeDoc(doc: Node) {
  const paragraph = doc.firstChild
  const children: ReturnType<typeof describeTextNode>[] = []
  paragraph?.forEach((child) => children.push(describeTextNode(child)))
  return {
    docType: doc.type.name,
    childCount: doc.childCount,
    paragraphType: paragraph?.type.name,
    children,
  }
}

describe('parseMarkdown', () => {
  it('parses inline marks (strong, link, strike, inline code) into the commonmark+gfm ProseMirror schema', async () => {
    const result = await parseMarkdown(
      'hello **#123** [text](https://x.io/76) ~~strike~~ `code`',
    )
    const doc = result._unsafeUnwrap()

    const actual = describeDoc(doc)
    const expected = {
      docType: 'doc',
      childCount: 1,
      paragraphType: 'paragraph',
      children: [
        { text: 'hello ', marks: [] },
        { text: '#123', marks: [{ type: 'strong' }] },
        { text: ' ', marks: [] },
        {
          text: 'text',
          marks: [{ type: 'link', href: 'https://x.io/76' }],
        },
        { text: ' ', marks: [] },
        { text: 'strike', marks: [{ type: 'strike_through' }] },
        { text: ' ', marks: [] },
        { text: 'code', marks: [{ type: 'inlineCode' }] },
      ],
    }
    expect(actual).toEqual(expected)
  })

  it('recovers after a failed parse of pathologically deep Markdown', async () => {
    const beforeFailure = await parseMarkdown('- [ ] Previous description')
    const failed = await parseMarkdown(
      `${'> '.repeat(5000)}x\n- [ ] Verify the result`,
    )
    const afterFailure = await parseMarkdown('- [ ] Verify the result')

    const getActual = () => ({
      beforeFailure: beforeFailure.isOk(),
      failureWasWrapped:
        failed.isErr() && failed.error instanceof MarkdownParseError,
      afterFailure: afterFailure.isOk(),
    })
    expect(getActual()).toEqual({
      beforeFailure: true,
      failureWasWrapped: true,
      afterFailure: true,
    })
  })
})
