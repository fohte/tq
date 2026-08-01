export function SidebarField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-[5px]">
      <span className="font-mono text-[10px] text-muted-foreground-faint">
        {label}
      </span>
      <div className="font-mono text-xs text-foreground">{children}</div>
    </div>
  )
}
