import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import { RecurringTemplateCreateModal } from '#components/recurring/recurring-template-create-modal'
import { RecurringTemplateListSection } from '#components/recurring/recurring-template-list-section'
import { RecurringTemplateListToolbar } from '#components/recurring/recurring-template-list-toolbar'
import { ListAreaMessage } from '#components/ui/list-area-message'
import { useRecurringTemplates } from '#hooks/use-recurring-templates'

export const Route = createFileRoute('/recurring/')({
  component: RecurringTemplateList,
})

function RecurringTemplateList() {
  const [showCreate, setShowCreate] = useState(false)
  const { data: templates, isLoading } = useRecurringTemplates()

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10">
        <RecurringTemplateListToolbar
          onCreate={() => {
            setShowCreate(true)
          }}
        />
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

      <RecurringTemplateCreateModal
        open={showCreate}
        onOpenChange={setShowCreate}
      />
    </div>
  )
}
