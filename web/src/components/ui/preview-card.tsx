'use client'

import { PreviewCard as PreviewCardPrimitive } from '@base-ui/react/preview-card'

import { cn } from '#lib/utils'

function PreviewCard<Payload>({
  ...props
}: PreviewCardPrimitive.Root.Props<Payload>) {
  return <PreviewCardPrimitive.Root data-slot="preview-card" {...props} />
}

function PreviewCardTrigger<Payload>({
  ...props
}: PreviewCardPrimitive.Trigger.Props<Payload>) {
  return (
    <PreviewCardPrimitive.Trigger data-slot="preview-card-trigger" {...props} />
  )
}

function PreviewCardPortal({ ...props }: PreviewCardPrimitive.Portal.Props) {
  return (
    <PreviewCardPrimitive.Portal data-slot="preview-card-portal" {...props} />
  )
}

function PreviewCardPositioner({
  className,
  sideOffset = 8,
  ...props
}: PreviewCardPrimitive.Positioner.Props) {
  return (
    <PreviewCardPrimitive.Positioner
      data-slot="preview-card-positioner"
      sideOffset={sideOffset}
      className={cn('z-50', className)}
      {...props}
    />
  )
}

function PreviewCardPopup({
  className,
  ...props
}: PreviewCardPrimitive.Popup.Props) {
  return (
    <PreviewCardPrimitive.Popup
      data-slot="preview-card-popup"
      className={cn(
        'w-72 rounded-xl bg-background p-3 text-sm ring-1 ring-foreground/10 duration-100 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
        className,
      )}
      {...props}
    />
  )
}

export {
  PreviewCard,
  PreviewCardPopup,
  PreviewCardPortal,
  PreviewCardPositioner,
  PreviewCardTrigger,
}
