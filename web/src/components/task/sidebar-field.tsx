// Shared chrome for a field's editable value: no border/height/padding of
// its own, so it reads as plain text until focused (matches the design's
// icon-less, borderless field rows).
export const fieldValueClassName =
  'h-auto w-full justify-start gap-1 border-0 bg-transparent p-0 font-mono text-xs text-foreground shadow-none hover:text-muted-foreground-strong focus-visible:ring-0'

export function SidebarField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-2xs text-muted-foreground-faint">
        {label}
      </span>
      <div className="font-mono text-xs text-foreground">{children}</div>
    </div>
  )
}
