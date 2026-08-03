import { cn } from '#lib/utils'

export function HtmlPageViewer({
  content,
  className,
}: {
  content: string
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
      className={cn('w-full border-0 bg-white', className)}
    />
  )
}
