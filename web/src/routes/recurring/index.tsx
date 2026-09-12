import { createFileRoute } from '@tanstack/react-router'

import { RecurringTemplateListSection } from '#components/recurring/recurring-template-list-section'
import { ListAreaMessage } from '#components/ui/list-area-message'
import { ScreenHeaderBar } from '#components/ui/screen-header-bar'
import { SectionHeading } from '#components/ui/section-heading'
import { useRecurringTemplates } from '#hooks/use-recurring-templates'

export const Route = createFileRoute('/recurring/')({
  component: RecurringTemplateList,
})

function RecurringTemplateList() {
  const { data: templates, isLoading } = useRecurringTemplates()

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10">
        <ScreenHeaderBar>
          <SectionHeading level={2}>recurring</SectionHeading>
        </ScreenHeaderBar>
      </div>

      <div>
        {isLoading ? (
          <ListAreaMessage>Loading...</ListAreaMessage>
        ) : !templates || templates.length === 0 ? (
          <ListAreaMessage>No recurring templates yet.</ListAreaMessage>
        ) : (
          <>
            <RecurringTemplateListSection
              label="Active"
              templates={templates.filter((t) => t.enabled)}
            />
            <RecurringTemplateListSection
              label="Paused"
              templates={templates.filter((t) => !t.enabled)}
            />
          </>
        )}
      </div>
    </div>
  )
}
