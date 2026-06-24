import { createFileRoute } from '@tanstack/react-router'
import { ProjectCard } from '@web/components/project/project-card'
import { ProjectFormModal } from '@web/components/project/project-form-modal'
import { Button } from '@web/components/ui/button'
import { useProjects } from '@web/hooks/use-projects'
import { cn } from '@web/lib/utils'
import { FolderKanban, Plus } from 'lucide-react'
import { useState } from 'react'

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
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h1 className="text-lg font-bold text-foreground">Projects</h1>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => {
            setShowCreate(true)
          }}
        >
          <Plus className="size-5" />
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 border-b border-border px-4 py-2">
        {(['active', 'all'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => {
              setFilter(tab)
            }}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              filter === tab
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground',
            )}
          >
            {tab === 'active' ? 'Active' : 'All'}
          </button>
        ))}
      </div>

      {/* Project list */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            Loading...
          </div>
        ) : projects && projects.length > 0 ? (
          <div className="flex flex-col gap-2">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
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
