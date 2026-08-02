import { Loader2 } from 'lucide-react'

export function SectionLoadingIndicator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
      <Loader2 className="size-3.5 animate-spin" />
      loading {label}...
    </div>
  )
}
