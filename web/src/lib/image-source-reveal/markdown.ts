import { fromMarkdown } from 'mdast-util-from-markdown'
import { toMarkdown } from 'mdast-util-to-markdown'

export interface ImageAttrs {
  src: string
  alt: string
  title: string
}

export interface ImageBlockAttrs {
  src: string
  caption: string
  ratio: number
}

// @milkdown/preset-commonmark's `image` toMarkdown and @milkdown/components'
// `image-block` toMarkdown (which reuses the `image` mdast shape but stores
// the resize ratio in the `alt` slot, see
// @milkdown/components/src/image-block/schema.ts) both serialize through
// mdast-util-to-markdown's own `image` handler, so this does too — a
// hand-rolled `![alt](src "title")` template wouldn't escape characters
// (quotes in a title, brackets in an alt, parens/whitespace in a src) the
// same way, breaking the round-trip for any image that has them.
function imageToText(url: string, alt: string, title: string): string {
  return toMarkdown({
    type: 'root',
    children: [
      { type: 'paragraph', children: [{ type: 'image', url, alt, title }] },
    ],
  }).trim()
}

export function imageAttrsToText({ src, alt, title }: ImageAttrs): string {
  return imageToText(src, alt, title)
}

export function imageBlockAttrsToText({
  src,
  caption,
  ratio,
}: ImageBlockAttrs): string {
  return imageToText(src, ratio.toFixed(2), caption)
}

function parseImageNode(text: string) {
  const [paragraph] = fromMarkdown(text.trim()).children
  if (paragraph?.type !== 'paragraph' || paragraph.children.length !== 1)
    return null
  const [node] = paragraph.children
  return node?.type === 'image' ? node : null
}

export function parseImageText(text: string): ImageAttrs | null {
  const node = parseImageNode(text)
  if (node == null) return null
  return { src: node.url, alt: node.alt ?? '', title: node.title ?? '' }
}

export function textToImageAttrs(text: string): ImageAttrs | null {
  return parseImageText(text)
}

// Same alt-as-ratio fallback as @milkdown/components'
// image-block/schema.ts parseMarkdown runner, so a hand-edited ratio that
// isn't a valid number round-trips to the same default instead of NaN.
export function textToImageBlockAttrs(text: string): ImageBlockAttrs | null {
  const parsed = parseImageText(text)
  if (parsed == null) return null
  let ratio = Number(parsed.alt || 1)
  if (Number.isNaN(ratio) || ratio === 0) ratio = 1
  return { src: parsed.src, caption: parsed.title, ratio }
}
