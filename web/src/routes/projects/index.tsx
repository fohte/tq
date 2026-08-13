import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import { ProjectFormModal } from '#components/project/project-form-modal'
import { ProjectListEmptyState } from '#components/project/project-list-empty-state'
import { ProjectListHeader } from '#components/project/project-list-header'
import { ProjectListRow } from '#components/project/project-list-row'
import { Button } from '#components/ui/button'
import { ScreenHeaderBar } from '#components/ui/screen-header-bar'
import { SectionHeading } from '#components/ui/section-heading'
import { TabStrip } from '#components/ui/tab-strip'
import { useProjects } from '#hooks/use-projects'

export const Route = createFileRoute('/projects/')({
  component: ProjectList,
})

type FilterTab = 'active' | 'all'

function ProjectList() {
  const [filter, setFilter] = useState<FilterTab>('active')
  const [showCreate, setShowCreate] = useState(false)

  const { data: projects, isLoading } = useProjects(
    filter === 'active' ? { status: 'active' } : undefined,
  )

  return (
    <div className="flex h-full flex-col">
      <ScreenHeaderBar>
        <SectionHeading level={2}>projects</SectionHeading>
        <TabStrip
          value={filter}
          options={[
            { value: 'active', label: 'active' },
            { value: 'all', label: 'all' },
          ]}
          onChange={setFilter}
          className="ml-2.5"
        />
        <Button
          size="xs"
          className="ml-auto text-2xs"
          onClick={() => {
            setShowCreate(true)
          }}
        >
          + new
        </Button>
      </ScreenHeaderBar>

      <ProjectListHeader />

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 font-mono text-xs text-muted-foreground">
            Loading...
          </div>
        ) : projects && projects.length > 0 ? (
          projects.map((project) => (
            <ProjectListRow key={project.id} project={project} />
          ))
        ) : (
          <ProjectListEmptyState
            onCreate={() => {
              setShowCreate(true)
            }}
          />
        )}
      </div>

      <ProjectFormModal open={showCreate} onOpenChange={setShowCreate} />
    </div>
  )
}
