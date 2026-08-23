import type { ParsedQuery } from 'api/search-query-parser'
import { buildSearchQuery } from 'api/search-query-parser'

import { ContextFilterInline } from '#components/context-filter'
import { TaskLabelFilterFields } from '#components/task/task-label-filter-fields'
import { TaskProjectFilterFields } from '#components/task/task-project-filter-fields'
import { TaskStatusFilterFields } from '#components/task/task-status-filter-fields'
import { SectionLabel } from '#components/ui/section-label'
import type { Project } from '#hooks/use-projects'
import { withLabel, withProjectId, withStatus } from '#lib/tasks-query'

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
            onQueryChange(buildSearchQuery(withStatus(parsed, status)))
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
              onQueryChange(buildSearchQuery(withProjectId(parsed, id)))
            }}
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <SectionLabel>LABEL</SectionLabel>
        <TaskLabelFilterFields
          selectedLabel={parsed.label}
          onLabelChange={(label) => {
            onQueryChange(buildSearchQuery(withLabel(parsed, label)))
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
