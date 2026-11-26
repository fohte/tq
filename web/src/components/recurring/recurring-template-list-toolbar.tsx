import { Button } from '@fohte/ui/button'

import { ScreenHeaderBar } from '#components/ui/screen-header-bar'
import { SectionHeading } from '#components/ui/section-heading'

export function RecurringTemplateListToolbar({
  onCreate,
}: {
  onCreate: () => void
}) {
  return (
    <ScreenHeaderBar>
      <SectionHeading level={2}>recurring</SectionHeading>
      <Button
        size="xs"
        className="ml-auto"
        onClick={() => {
          onCreate()
        }}
      >
        + new
      </Button>
    </ScreenHeaderBar>
  )
}
