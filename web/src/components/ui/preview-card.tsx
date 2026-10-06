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
  padding = 'default',
  ...props
}: PreviewCardPrimitive.Popup.Props & { padding?: 'default' | 'none' }) {
  return (
    <PreviewCardPrimitive.Popup
      data-slot="preview-card-popup"
      className={cn(
        'w-72 rounded-xl bg-background text-sm ring-1 ring-foreground/10 duration-100 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
        padding === 'default' && 'p-3',
        className,
      )}
      {...props}
    />
  )
}

// Header + list body used by every hover card that previews "all N items"
// behind a single trigger (SessionIndicator, GithubLinksChipGroup).
function PreviewListPopup({
  label,
  count,
  children,
}: {
  label: string
  count: number
  children: React.ReactNode
}) {
  return (
    // An explicit width (not `min-w-*` on `w-auto`) is required here: with
    // `w-auto`, the popup's shrink-to-fit width is driven by its children's
    // untruncated max-content width regardless of any min-width, since
    // min-width only raises a floor and never caps growth.
    <PreviewCardPopup padding="none" className="w-(--width-preview-popup)">
      <div className="border-b border-border px-3 py-1.5 font-mono text-2xs tracking-widest text-muted-foreground-faint">
        {label} ({count})
      </div>
      {children}
    </PreviewCardPopup>
  )
}

export {
  PreviewCard,
  PreviewCardPopup,
  PreviewCardPortal,
  PreviewCardPositioner,
  PreviewCardTrigger,
  PreviewListPopup,
}
