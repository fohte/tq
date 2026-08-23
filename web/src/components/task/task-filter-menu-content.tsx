import { CheckIcon } from 'lucide-react'

import { ContextFilterInline } from '#components/context-filter'
import { Checkbox } from '#components/ui/checkbox'
import { SectionLabel } from '#components/ui/section-label'
import { TabStrip } from '#components/ui/tab-strip'
import type { Project } from '#hooks/use-projects'
import type { TaskSortBy } from '#hooks/use-tasks'
import { sortLabels, sortOptionValues } from '#lib/tasks-query'
import { cn } from '#lib/utils'

function ProjectOptionButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-9 w-full items-center justify-between gap-2 border-t border-border px-1 text-left text-sm first:border-t-0',
        active ? 'text-foreground' : 'text-muted-foreground',
      )}
    >
      {children}
      {active && <CheckIcon className="size-4" />}
    </button>
  )
}

interface TaskFilterMenuContentProps {
  showCompleted: boolean
  onShowCompletedChange: (checked: boolean) => void
  sortBy: TaskSortBy
  onSortByChange: (sortBy: TaskSortBy) => void
  projects: Project[]
  selectedProjectId: string | undefined
  onProjectIdChange: (id: string) => void
  // PC has the same picker in the sidebar, so the caller only passes true
  // for the mobile bottom sheet.
  showContext: boolean
}

// The contents of the show completed / sort / project / context filter
// menu, shared by FilterMenu's desktop dropdown and mobile bottom sheet.
// Rendered directly (not behind useIsDesktop) so its story can drive play()
// interactions under VRT's mobile viewport.
export function TaskFilterMenuContent({
  showCompleted,
  onShowCompletedChange,
  sortBy,
  onSortByChange,
  projects,
  selectedProjectId,
  onProjectIdChange,
  showContext,
}: TaskFilterMenuContentProps) {
  return (
    <>
      <div className="flex items-center gap-2">
        <Checkbox
          id="task-filter-show-completed"
          checked={showCompleted}
          onCheckedChange={onShowCompletedChange}
        />
        <label
          htmlFor="task-filter-show-completed"
          className="text-sm text-foreground"
        >
          show completed
        </label>
      </div>

      <div className="flex flex-col gap-1.5">
        <SectionLabel>SORT</SectionLabel>
        <TabStrip
          value={sortBy}
          options={sortOptionValues.map((sort) => ({
            value: sort,
            label: sortLabels[sort] ?? sort,
          }))}
          onChange={onSortByChange}
        />
      </div>

      {projects.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <SectionLabel>PROJECT</SectionLabel>
          <div>
            <ProjectOptionButton
              active={selectedProjectId == null || selectedProjectId === ''}
              onClick={() => {
                onProjectIdChange('')
              }}
            >
              All projects
            </ProjectOptionButton>
            {projects.map((project) => (
              <ProjectOptionButton
                key={project.id}
                active={selectedProjectId === project.id}
                onClick={() => {
                  onProjectIdChange(project.id)
                }}
              >
                {project.title}
              </ProjectOptionButton>
            ))}
          </div>
        </div>
      )}

      {showContext && (
        <div className="flex flex-col gap-1.5">
          <SectionLabel>CONTEXT</SectionLabel>
          <ContextFilterInline />
        </div>
      )}
    </>
  )
}
