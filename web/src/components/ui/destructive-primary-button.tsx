import { Button } from '@fohte/ui/button'
import type { ComponentProps } from 'react'

import { cn } from '#lib/utils'

type DestructivePrimaryButtonProps = Omit<
  ComponentProps<typeof Button>,
  'variant'
>

export function DestructivePrimaryButton({
  className,
  ...props
}: DestructivePrimaryButtonProps) {
  return (
    <Button
      {...props}
      variant="default"
      className={cn(
        'border-destructive bg-destructive text-destructive-foreground hover:border-destructive hover:bg-destructive/90 hover:text-destructive-foreground focus-visible:border-destructive/40 focus-visible:ring-destructive/20',
        className,
      )}
    />
  )
}
