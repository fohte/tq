import type { ReactNode } from 'react'

import { cn } from '#lib/utils'

export function Chip({
  as = 'span',
  size = 'sm',
  active = false,
  className,
  children,
}: {
  as?: 'span' | 'button'
  size?: 'sm' | 'md'
  active?: boolean
  className?: string
  children: ReactNode
}) {
  const classes = cn(
    'inline-flex items-center gap-1 border font-mono',
    size === 'sm'
      ? 'px-1 text-[9px] leading-[14px]'
      : 'px-1.5 py-0.5 text-[11px]',
    active
      ? 'border-border-strong text-foreground'
      : 'border-border text-muted-foreground',
    as === 'button' && 'cursor-pointer',
    className,
  )

  if (as === 'button') {
    return (
      <button type="button" className={classes}>
        {children}
      </button>
    )
  }

  return <span className={classes}>{children}</span>
}
