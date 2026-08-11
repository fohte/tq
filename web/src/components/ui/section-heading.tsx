import type { ReactNode } from 'react'

import { cn } from '#lib/utils'

export function SectionHeading({
  level,
  children,
  className,
}: {
  level: 2 | 3
  children: ReactNode
  className?: string
}) {
  return (
    <span className={cn('inline-flex items-baseline gap-2', className)}>
      <span className="font-mono text-xs font-bold text-primary">
        {level === 2 ? '##' : '###'}
      </span>
      <span
        className={cn(
          'font-mono',
          level === 2 ? 'text-xs font-medium' : 'text-sm font-bold',
        )}
      >
        {children}
      </span>
    </span>
  )
}
