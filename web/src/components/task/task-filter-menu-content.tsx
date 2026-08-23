import type { ParsedQuery } from 'api/search-query-parser'
import { buildSearchQuery } from 'api/search-query-parser'

import { ContextFilterInline } from '#components/context-filter'
import { TaskLabelFilterFields } from '#components/task/task-label-filter-fields'
import { TaskProjectFilterFields } from '#components/task/task-project-filter-fields'
import { TaskStatusFilterFields } from '#components/task/task-status-filter-fields'
import { SectionLabel } from '#components/ui/section-label'
import type { Project } from '#hooks/use-projects'

interface TaskFilterMenuContentProps {
  parsed: ParsedQuery
  onQueryChange: (query: string) => void
  projects: Project[]
  // PC has the same picker in the sidebar, so the caller only passes true
  // for the mobile bottom sheet.
  showContext: boolean
}

// The contents of the `+ filter` menu: entry points for axes that aren't
// necessarily applied yet (status, project, label, context). Sort has no
// section here since it always has a value and is reachable directly via
// its own pinned chip. Shared by FilterMenu's desktop dropdown and mobile
// bottom sheet. Rendered directly (not behind useIsDesktop) so its story can
// drive play() interactions under VRT's mobile viewport.
export function TaskFilterMenuContent({
  parsed,
  onQueryChange,
  projects,
  showContext,
}: TaskFilterMenuContentProps) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <SectionLabel>STATUS</SectionLabel>
        <TaskStatusFilterFields
          status={parsed.status ?? []}
          onStatusChange={(status) => {
            const next = { ...parsed }
            if (status.length === 0) delete next.status
            else next.status = status
            onQueryChange(buildSearchQuery(next))
          }}
        />
      </div>

      {projects.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <SectionLabel>PROJECT</SectionLabel>
          <TaskProjectFilterFields
            projects={projects}
            selectedProjectId={parsed.projectId}
            onProjectIdChange={(id) => {
              const next = { ...parsed }
              if (id === '') delete next.projectId
              else next.projectId = id
              onQueryChange(buildSearchQuery(next))
            }}
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <SectionLabel>LABEL</SectionLabel>
        <TaskLabelFilterFields
          selectedLabel={parsed.label}
          onLabelChange={(label) => {
            const next = { ...parsed }
            if (label == null) delete next.label
            else next.label = label
            onQueryChange(buildSearchQuery(next))
          }}
        />
      </div>

      {showContext && (
        <div className="flex flex-col gap-1.5">
          <SectionLabel>CONTEXT</SectionLabel>
          <ContextFilterInline />
        </div>
      )}
    </>
  )
}
