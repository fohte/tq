export const sidebarFieldValueButtonClassName =
  'h-auto min-h-0 shrink justify-start whitespace-normal gap-0 rounded-none border-0 bg-transparent p-0 font-normal shadow-none transition-none hover:bg-transparent active:translate-y-0 w-full cursor-text text-left text-xs transition-colors hover:text-muted-foreground-strong'

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
