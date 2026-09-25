import { Check } from 'lucide-react'

export function UrlCopiedToast({ url }: { url: string | null }) {
  if (url === null) return null

  return (
    <div
      role="status"
      className="pointer-events-none fixed right-4 bottom-4 z-50 flex max-w-md items-center gap-2 border border-border-strong bg-card px-3 py-2 font-mono text-xs text-foreground"
    >
      <Check aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="shrink-0">URL copied</span>
      <span className="min-w-0 truncate text-muted-foreground">{url}</span>
    </div>
  )
}
