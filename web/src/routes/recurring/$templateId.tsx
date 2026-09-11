import { createFileRoute } from '@tanstack/react-router'

import { RecurringTemplateMainContent } from '#components/recurring/recurring-template-detail-main'
import {
  RecurringTemplateSidebar,
  RecurringTemplateSidebarMobile,
} from '#components/recurring/recurring-template-detail-sidebar'
import { FullPageLoading } from '#components/ui/full-page-loading'
import { FullPageMessage } from '#components/ui/full-page-message'
import { useRecurringTemplate } from '#hooks/use-recurring-templates'

export const Route = createFileRoute('/recurring/$templateId')({
  component: RecurringTemplatePage,
})

function RecurringTemplatePage() {
  const { templateId } = Route.useParams()
  const { data: template, isLoading, error } = useRecurringTemplate(templateId)

  if (isLoading) {
    return <FullPageLoading />
  }

  if (error || !template) {
    return <FullPageMessage>Template not found</FullPageMessage>
  }

  return (
    <>
      {/* PC layout */}
      <div className="hidden md:flex">
        <div className="flex-1 px-7 py-6">
          <RecurringTemplateMainContent template={template} />
        </div>
        <RecurringTemplateSidebar template={template} />
      </div>

      {/* SP layout */}
      <div className="flex flex-col p-4 md:hidden">
        <RecurringTemplateSidebarMobile template={template} />
        <div className="mt-4 border-t border-border pt-4">
          <RecurringTemplateMainContent template={template} />
        </div>
      </div>
    </>
  )
}
