import type { Mark, Node, NodeType } from '@milkdown/kit/prose/model'

export interface TextBlockRun {
  text: string
  /** Maps an index into `text` (0..text.length inclusive) to a doc position. */
  posAt: (index: number) => number
  /** Node type name of the textblock itself (e.g. 'paragraph', 'heading', 'code_block'). */
  nodeType: string
}

// Non-text inline leaves (hard breaks, images, ...) — and masked text runs,
// see isNonReferenceText below — are represented by this placeholder so a
// pattern can't accidentally match across/into them, while keeping every
// character of `text` mapped to exactly one doc position.
const LEAF_PLACEHOLDER = '￼'

// Code content (NodeSpec.code / MarkSpec.code) is never a reference. A
// link's display text describes wherever the link points, not a tq
// resource — except a GFM autolink literal, whose display text is the URL
// itself (href === text), which the taskUrl/projectUrl/githubUrl/
// slackPermalink providers still need to see.
function isNonReferenceText(
  marks: readonly Mark[],
  text: string,
  nodeType: NodeType,
): boolean {
  if (nodeType.spec.code === true) return true
  return marks.some((mark) => {
    if (mark.type.spec.code === true) return true
    if (mark.type.name === 'link' && typeof mark.attrs['href'] === 'string') {
      return mark.attrs['href'] !== text
    }
    return false
  })
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
    let childOffset = 1

    node.forEach((child) => {
      if (child.isText && child.text != null) {
        const childText = child.text
        for (let i = 0; i < childText.length; i++) {
          offsets.push(pos + childOffset + i)
        }
        text += isNonReferenceText(child.marks, childText, node.type)
          ? LEAF_PLACEHOLDER.repeat(childText.length)
          : childText
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
    })

    // Already extracted this block's text manually; don't descend into its
    // inline children too.
    return false
  })

  return runs
}
