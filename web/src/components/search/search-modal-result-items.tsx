import { Button } from '@fohte/ui/button'
import { Link } from '@tanstack/react-router'
import type { MouseEvent, ReactNode } from 'react'

import {
  isProjectStatus,
  type ProjectStatus,
  ProjectStatusMark,
} from '#components/project/project-status-mark'
import { TaskRowAppearance } from '#components/task/task-row-appearance'
import type { Project } from '#hooks/use-projects'
import type { SavedView } from '#hooks/use-saved-views'
import type { PageSearchResult, SearchResult } from '#hooks/use-search'
import { cn } from '#lib/utils'

export interface ListItem {
  key: string
  select: () => void
  selectOnTab?: () => void
  render: (props: ListItemRenderProps) => ReactNode
}

type BodySearchMatch = Extract<
  NonNullable<SearchResult['match']>,
  { field: 'description' | 'page' }
>

export function isTitleSearchMatch(task: SearchResult) {
  return task.match?.field === 'title'
}

export function getBodySearchMatch(
  task: SearchResult,
): BodySearchMatch | undefined {
  return task.match?.field === 'description' || task.match?.field === 'page'
    ? task.match
    : undefined
}

interface ListItemRenderProps {
  isSelected: boolean
  onMouseMove: (event: MouseEvent<HTMLElement>) => void
}

export function createOptionItem(
  key: string,
  select: () => void,
  content: ReactNode,
  options: { selectOnTab?: () => void; className?: string } = {},
): ListItem {
  const { className, ...listItemOptions } = options
  return {
    key,
    select,
    ...listItemOptions,
    render: ({ isSelected, onMouseMove }) => (
      <Button
        type="button"
        variant="ghost"
        role="option"
        aria-selected={isSelected}
        data-selected={isSelected}
        onClick={select}
        onMouseMove={onMouseMove}
        className={cn(
          'h-auto min-h-0 w-full justify-start gap-0 rounded-none border-0 bg-transparent p-0 font-inherit font-normal shadow-none transition-none hover:bg-transparent active:translate-y-0 focus-visible:border-transparent focus-visible:ring-0 flex items-center gap-2 px-4 py-2 text-left whitespace-normal',
          isSelected ? 'bg-accent hover:bg-accent' : 'hover:bg-accent/50',
          className,
        )}
      >
        {content}
      </Button>
    ),
  }
}

export function createProjectItems(
  projects: Project[] | undefined,
  openProject: (project: Project) => void,
  scopeProject?: (project: Project) => void,
): ListItem[] {
  return (
    projects?.map((project) => {
      const status: ProjectStatus = isProjectStatus(project.status)
        ? project.status
        : 'active'
      const select = () => {
        openProject(project)
      }
      const selectOnTab =
        scopeProject == null
          ? undefined
          : () => {
              scopeProject(project)
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
        selectOnTab == null ? {} : { selectOnTab },
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

export function createPageItems(
  pages: PageSearchResult[] | undefined,
  openPage: (page: PageSearchResult) => void,
  onOpenChangeRef: { current: (open: boolean) => void },
): ListItem[] {
  return (
    pages?.flatMap((page): ListItem[] => {
      if (
        page.source !== 'page' ||
        page.pageId == null ||
        page.pageTitle == null
      ) {
        return []
      }
      const pageId = page.pageId
      const select = () => {
        openPage(page)
      }
      return [
        {
          key: pageId,
          select,
          render: ({ isSelected, onMouseMove }) => (
            <Link
              to="/tasks/$taskId/pages/$pageId"
              params={{
                taskId: String(page.taskNumber),
                pageId,
              }}
              role="option"
              aria-selected={isSelected}
              data-selected={isSelected}
              onMouseMove={onMouseMove}
              onClick={(e) => {
                if (
                  e.button !== 0 ||
                  e.metaKey ||
                  e.ctrlKey ||
                  e.shiftKey ||
                  e.altKey
                ) {
                  return
                }
                onOpenChangeRef.current(false)
              }}
              className={cn(
                'block px-4 py-2',
                isSelected ? 'bg-accent' : 'hover:bg-accent/50',
              )}
            >
              <span className="block truncate font-mono text-sm font-medium text-foreground">
                {page.pageTitle}
              </span>
              <div className="truncate text-2xs text-muted-foreground">
                #{page.taskNumber} {page.taskTitle}
              </div>
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {page.snippet}
              </p>
            </Link>
          ),
        },
      ]
    }) ?? []
  )
}

export function renderTaskOption(
  task: SearchResult,
  onOpenChangeRef: { current: (open: boolean) => void },
  freeTextQuery = '',
): ListItem['render'] {
  const isTitleMatch = isTitleSearchMatch(task)
  const bodyMatch = getBodySearchMatch(task)
  const titleContent =
    isTitleMatch && freeTextQuery.length > 0
      ? highlightSearchMatches(task.title, freeTextQuery)
      : task.title
  const matchLabel =
    bodyMatch?.field === 'description'
      ? '説明'
      : bodyMatch?.field === 'page'
        ? `page: ${bodyMatch.pageTitle}`
        : undefined

  return ({ isSelected, onMouseMove }) => (
    <div
      role="option"
      aria-selected={isSelected}
      data-selected={isSelected}
      onMouseMove={onMouseMove}
      className={cn(isSelected ? 'bg-accent' : 'hover:bg-accent/50')}
    >
      <TaskRowAppearance
        task={task}
        titleContent={titleContent}
        belowMetadata={
          bodyMatch != null && matchLabel != null ? (
            <div className="flex min-w-0 items-baseline gap-2 text-xs text-muted-foreground">
              <span className="max-w-40 shrink-0 truncate">{matchLabel}</span>
              <span className="min-w-0 truncate">
                {highlightSearchMatches(bodyMatch.snippet, freeTextQuery)}
              </span>
            </div>
          ) : undefined
        }
        onClick={(e) => {
          // Let the router's own modifier/middle-click handling
          // open a new tab without closing this one's search.
          if (
            e.button !== 0 ||
            e.metaKey ||
            e.ctrlKey ||
            e.shiftKey ||
            e.altKey
          ) {
            return
          }
          onOpenChangeRef.current(false)
        }}
      />
    </div>
  )
}

function highlightSearchMatches(text: string, query: string) {
  const terms = query
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean)
    .sort((left, right) => right.length - left.length)
  if (terms.length === 0) return text

  const pattern = new RegExp(terms.map(escapeRegExp).join('|'), 'gi')
  const parts: ReactNode[] = []
  let lastIndex = 0

  for (const match of text.matchAll(pattern)) {
    const matchedText = match[0]
    const matchIndex = match.index

    if (matchIndex > lastIndex) {
      parts.push(text.slice(lastIndex, matchIndex))
    }
    parts.push(
      <mark
        key={`${String(matchIndex)}:${matchedText}`}
        className="rounded-sm bg-primary/20 text-inherit"
      >
        {matchedText}
      </mark>,
    )
    lastIndex = matchIndex + matchedText.length
  }

  if (lastIndex === 0) return text
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
