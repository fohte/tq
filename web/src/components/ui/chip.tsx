import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'

import { cn } from '#lib/utils'

type ChipOwnProps = {
  as?: 'span' | 'button'
  size?: 'sm' | 'md'
  active?: boolean
  className?: string
  children: ReactNode
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
