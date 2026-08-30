import { createFileRoute } from '@tanstack/react-router'

import { SidebarContent } from '#components/layout/sidebar'
import { ScreenHeaderBar } from '#components/ui/screen-header-bar'
import { SectionHeading } from '#components/ui/section-heading'

export const Route = createFileRoute('/browse')({
  component: Browse,
})

function Browse() {
  return (
    <div className="flex h-full flex-col md:hidden">
      <ScreenHeaderBar>
        <SectionHeading level={2}>browse</SectionHeading>
      </ScreenHeaderBar>

      <SidebarContent />
    </div>
  )
}
