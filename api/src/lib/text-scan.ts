import type { Mark, Node, NodeType } from '@milkdown/kit/prose/model'

export interface TextBlockRun {
  text: string
  /** Maps an index into `text` (0..text.length inclusive) to a doc position. */
  posAt: (index: number) => number
  /** Node type name of the textblock itself (e.g. 'paragraph', 'heading', 'code_block'). */
  nodeType: string
  /**
   * hrefs of labeled links (display text differs from the href, so
   * isNonReferenceText masks it out of `text`) in this textblock — the only
   * place their target URL is still visible to a caller that needs it (e.g.
   * a `[label](https://.../tasks/123)` reference).
   */
  hrefs: string[]
}

// Non-text inline leaves (hard breaks, images, ...) — and masked text runs,
// see isNonReferenceText below — are represented by this placeholder so a
// pattern can't accidentally match across/into them, while keeping every
// character of `text` mapped to exactly one doc position.
const LEAF_PLACEHOLDER = '￼'

// The href of a link mark whose display text doesn't match it (a labeled
// link) — undefined for anything else, including an unmasked autolink, whose
// href already equals `text`.
function maskedLinkHref(
  marks: readonly Mark[],
  text: string,
): string | undefined {
  for (const mark of marks) {
    if (
      mark.type.name === 'link' &&
      typeof mark.attrs['href'] === 'string' &&
      mark.attrs['href'] !== text
    ) {
      return mark.attrs['href']
    }
  }
  return undefined
}

// Code content (NodeSpec.code / MarkSpec.code) is never a reference. A
// labeled link's display text describes wherever the link points, not a tq
// resource — except a GFM autolink literal, whose display text is the URL
// itself (href === text), which the taskUrl/projectUrl/githubUrl/
// slackPermalink providers still need to see.
function isNonReferenceText(
  marks: readonly Mark[],
  text: string,
  nodeType: NodeType,
): boolean {
  if (nodeType.spec.code === true) return true
  if (marks.some((mark) => mark.type.spec.code === true)) return true
  return maskedLinkHref(marks, text) != null
}

// Scans the document one textblock at a time (paragraphs, headings, code
// blocks, ...) rather than the whole document at once, since an inline
// pattern like `#123` never spans a block boundary.
export function collectTextBlockRuns(doc: Node): TextBlockRun[] {
  const runs: TextBlockRun[] = []

  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true

    let text = ''
    const offsets: number[] = []
    const hrefs: string[] = []
    let childOffset = 1

    node.forEach((child) => {
      if (child.isText && child.text != null) {
        const childText = child.text
        for (let i = 0; i < childText.length; i++) {
          offsets.push(pos + childOffset + i)
        }
        if (isNonReferenceText(child.marks, childText, node.type)) {
          text += LEAF_PLACEHOLDER.repeat(childText.length)
          const href = maskedLinkHref(child.marks, childText)
          if (href != null) hrefs.push(href)
        } else {
          text += childText
        }
      } else {
        offsets.push(pos + childOffset)
        text += LEAF_PLACEHOLDER
      }
      childOffset += child.nodeSize
    })

    const contentEnd = pos + childOffset
    runs.push({
      text,
      posAt: (index) => offsets[index] ?? contentEnd,
      nodeType: node.type.name,
      hrefs,
    })

    // Already extracted this block's text manually; don't descend into its
    // inline children too.
    return false
  })

  return runs
}
