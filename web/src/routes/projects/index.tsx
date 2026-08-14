import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import { ProjectFormModal } from '#components/project/project-form-modal'
import { ProjectListEmptyState } from '#components/project/project-list-empty-state'
import { ProjectListHeader } from '#components/project/project-list-header'
import { ProjectListRow } from '#components/project/project-list-row'
import {
  type ProjectFilterTab,
  ProjectListToolbar,
} from '#components/project/project-list-toolbar'
import { ListAreaMessage } from '#components/ui/list-area-message'
import { useProjects } from '#hooks/use-projects'

export const Route = createFileRoute('/projects/')({
  component: ProjectList,
})

function ProjectList() {
  const [filter, setFilter] = useState<ProjectFilterTab>('active')
  const [showCreate, setShowCreate] = useState(false)

  const { data: projects, isLoading } = useProjects(
    filter === 'active' ? { status: 'active' } : undefined,
  )

  return (
    <div className="flex h-full flex-col">
      <ProjectListToolbar
        filter={filter}
        onFilterChange={setFilter}
        onCreate={() => {
          setShowCreate(true)
        }}
      />

      <ProjectListHeader />

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <ListAreaMessage>Loading...</ListAreaMessage>
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
