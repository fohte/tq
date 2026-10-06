import * as React from 'react'

import { cn } from '#lib/utils'

type TextareaProps = React.ComponentProps<'textarea'> & {
  variant?: 'default' | 'code' | 'monospace'
}

function Textarea({ className, variant = 'default', ...props }: TextareaProps) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex field-sizing-content min-h-16 w-full rounded-none border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
        variant === 'code' && 'bg-card p-3 font-code text-xs leading-relaxed',
        variant === 'monospace' && 'font-mono',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
