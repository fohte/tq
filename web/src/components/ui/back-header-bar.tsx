import { createLink, type LinkComponent } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { forwardRef } from 'react'

import { ScreenHeaderBar } from '#components/ui/screen-header-bar'

const BackAnchor = forwardRef<
  HTMLAnchorElement,
  React.AnchorHTMLAttributes<HTMLAnchorElement>
>(function BackAnchor({ children, ...props }, ref) {
  return (
    <a
      ref={ref}
      {...props}
      className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ChevronLeft className="size-5" />
      {children}
    </a>
  )
})

const BackLink = createLink(BackAnchor)

export const BackHeaderBar: LinkComponent<typeof BackAnchor> = (props) => (
  <ScreenHeaderBar className="h-12 md:hidden">
    <BackLink {...props} />
  </ScreenHeaderBar>
)
