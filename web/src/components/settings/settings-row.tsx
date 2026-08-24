import type { ReactNode } from 'react'

export function SettingsRow({
  label,
  description,
  children,
}: {
  label: string
  description: string
  children: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-4">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  )
}
