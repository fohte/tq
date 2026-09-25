import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'

import { cn } from '#lib/utils'

type ChipOwnProps = {
  as?: 'span' | 'button'
  size?: 'sm' | 'md'
  active?: boolean
  className?: string
  children: ReactNode
}

function chipClassName({
  size = 'sm',
  active = false,
  className,
}: {
  size?: 'sm' | 'md'
  active?: boolean
  className?: string
}) {
  return cn(
    'inline-flex items-center gap-1 border font-mono text-2xs',
    size === 'sm' ? 'px-1' : 'px-1.5 py-0.5',
    active
      ? 'border-border-strong text-foreground'
      : 'border-border text-muted-foreground',
    className,
  )
}

export function Chip({
  as = 'span',
  size = 'sm',
  active = false,
  className,
  children,
  ...rest
}: ChipOwnProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof ChipOwnProps> &
  Omit<HTMLAttributes<HTMLSpanElement>, keyof ChipOwnProps>) {
  const classes = chipClassName({
    size,
    active,
    className: cn(as === 'button' && 'cursor-pointer', className),
  })

  if (as === 'button') {
    return (
      <button type="button" className={classes} {...rest}>
        {children}
      </button>
    )
  }

  return (
    <span className={classes} {...rest}>
      {children}
    </span>
  )
}
