// Mirrors @milkdown/preset-commonmark's `image` toMarkdown (plain
// `![alt](src "title")`) and @milkdown/components' `image-block` toMarkdown
// (which reuses the `image` mdast shape but stores the resize ratio in the
// `alt` slot, see @milkdown/components/src/image-block/schema.ts) — the two
// serializers this text has to stay interchangeable with.
const IMAGE_TEXT_PATTERN =
  /^!\[(?<alt>[^\]]*)\]\((?<src>[^\s)]*)(?:\s+"(?<title>[^"]*)")?\)$/

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

function toImageText(src: string, alt: string, title: string): string {
  return title ? `![${alt}](${src} "${title}")` : `![${alt}](${src})`
}

export function imageAttrsToText({ src, alt, title }: ImageAttrs): string {
  return toImageText(src, alt, title)
}

export function imageBlockAttrsToText({
  src,
  caption,
  ratio,
}: ImageBlockAttrs): string {
  return toImageText(src, Number.parseFloat(String(ratio)).toFixed(2), caption)
}

export function parseImageText(text: string): ImageAttrs | null {
  const match = IMAGE_TEXT_PATTERN.exec(text.trim())
  if (match?.groups == null) return null
  const { alt = '', src = '', title = '' } = match.groups
  return { src, alt, title }
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
