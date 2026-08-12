import { cn } from '#lib/utils'

export function HtmlPageViewer({
  content,
  // 'default' (400px, a fixed height) suits a standalone viewer with no
  // sized ancestor; 'fill' stretches to fill a flex-column ancestor that
  // already has a defined height (e.g. HtmlPageEditor in 'fill' mode).
  size = 'default',
  className,
}: {
  content: string
  size?: 'default' | 'fill'
  className?: string
}) {
  return (
    <iframe
      srcDoc={content}
      // `allow-same-origin` is deliberately omitted: without it the iframe
      // gets an opaque origin, so scripts inside it (allowed by
      // `allow-scripts`) can't reach this app's cookies, localStorage, or
      // same-origin API.
      sandbox="allow-scripts"
      title="HTML page content"
      className={cn(
        'w-full border-0 bg-white',
        size === 'fill' ? 'min-h-0 flex-1' : 'h-100',
        className,
      )}
    />
  )
}
