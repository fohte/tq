import { createFileRoute } from '@tanstack/react-router'
import { FolderKanban } from 'lucide-react'
import { useState } from 'react'

import { ProjectFormModal } from '#components/project/project-form-modal'
import {
  PROJECT_LIST_GRID_COLUMNS,
  ProjectListRow,
} from '#components/project/project-list-row'
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

      {/* Column header (desktop only) */}
      <div
        className={`hidden border-b border-border bg-card px-3.5 py-1.5 font-mono text-2xs tracking-widest text-muted-foreground-faint md:grid md:items-center md:gap-3 ${PROJECT_LIST_GRID_COLUMNS}`}
      >
        <span />
        <span>PROJECT</span>
        <span>STATUS</span>
        <span>PROGRESS</span>
        <span className="text-right">TARGET</span>
      </div>

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
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <FolderKanban className="size-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No projects yet</p>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreate(true)
              }}
            >
              Create your first project
            </Button>
          </div>
        )}
      </div>

      <ProjectFormModal open={showCreate} onOpenChange={setShowCreate} />
    </div>
  )
}
