import type { Node } from '@milkdown/kit/prose/model'

export interface TextBlockRun {
  text: string
  /** Maps an index into `text` (0..text.length inclusive) to a doc position. */
  posAt: (index: number) => number
}

// Non-text inline leaves (hard breaks, images, ...) are represented by this
// placeholder so a pattern can't accidentally match across them, while
// keeping every character of `text` mapped to exactly one doc position.
const LEAF_PLACEHOLDER = '￼'

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
        for (let i = 0; i < child.text.length; i++) {
          offsets.push(pos + childOffset + i)
        }
        text += child.text
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
    })

    // Already extracted this block's text manually; don't descend into its
    // inline children too.
    return false
  })

  return runs
}
