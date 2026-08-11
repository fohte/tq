import type { ReactNode } from 'react'

import { cn } from '#lib/utils'

export function Panel({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn('border border-border', className)}>{children}</div>
}

export function PanelHeader({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 border-b border-border bg-secondary px-3 py-1.5 font-mono text-2xs tracking-widest text-muted-foreground-faint',
        className,
      )}
    >
      {children}
    </div>
  )
}
