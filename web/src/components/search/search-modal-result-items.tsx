import type { MouseEvent, ReactNode } from 'react'

import {
  isProjectStatus,
  type ProjectStatus,
  ProjectStatusMark,
} from '#components/project/project-status-mark'
import type { Project } from '#hooks/use-projects'
import type { SavedView } from '#hooks/use-saved-views'
import { cn } from '#lib/utils'

export interface ListItem {
  key: string
  select: () => void
  selectOnTab?: () => void
  render: (props: ListItemRenderProps) => ReactNode
}

export interface ListItemRenderProps {
  isSelected: boolean
  onMouseMove: (event: MouseEvent<HTMLElement>) => void
}

function createOptionItem(
  key: string,
  select: () => void,
  content: ReactNode,
): ListItem {
  return {
    key,
    select,
    render: ({ isSelected, onMouseMove }) => (
      <button
        type="button"
        role="option"
        aria-selected={isSelected}
        data-selected={isSelected}
        onClick={select}
        onMouseMove={onMouseMove}
        className={cn(
          'flex w-full items-center gap-2 px-4 py-2 text-left',
          isSelected ? 'bg-accent' : 'hover:bg-accent/50',
        )}
      >
        {content}
      </button>
    ),
  }
}

export function createProjectItems(
  projects: Project[] | undefined,
  openProject: (project: Project) => void,
): ListItem[] {
  return (
    projects?.map((project) => {
      const status: ProjectStatus = isProjectStatus(project.status)
        ? project.status
        : 'active'
      const select = () => {
        openProject(project)
      }

      return createOptionItem(
        `project:${project.id}`,
        select,
        <>
          <ProjectStatusMark status={status} />
          <span className="truncate font-mono text-sm text-foreground">
            {project.title}
          </span>
        </>,
      )
    }) ?? []
  )
}

export function createViewItems(
  savedViews: SavedView[] | undefined,
  openView: (view: SavedView) => void,
): ListItem[] {
  return (
    savedViews?.map((view) => {
      const select = () => {
        openView(view)
      }

      return createOptionItem(
        `view:${view.id}`,
        select,
        <span className="font-mono text-sm text-foreground">{view.name}</span>,
      )
    }) ?? []
  )
}
