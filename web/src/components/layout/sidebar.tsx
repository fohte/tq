import { Link, useMatchRoute, useSearch } from '@tanstack/react-router'
import { parseSearchQuery } from 'api/search-query-parser'
import { Pencil, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'

import { ContextFilter } from '#components/context-filter'
import {
  isProjectStatus,
  type ProjectStatus,
  ProjectStatusMark,
} from '#components/project/project-status-mark'
import { RenameSavedViewDialog } from '#components/saved-view/rename-saved-view-dialog'
import { ActionsMenu } from '#components/ui/actions-menu'
import { DeleteConfirmDialog } from '#components/ui/delete-confirm-dialog'
import { KeybindHint } from '#components/ui/keybind-hint'
import { useProjects } from '#hooks/use-projects'
import type { SavedView } from '#hooks/use-saved-views'
import { useDeleteSavedView, useSavedViews } from '#hooks/use-saved-views'
import { useTagCounts } from '#hooks/use-tag-counts'
import { navKeybindings } from '#lib/keybindings'
import { tagFilterSearch } from '#lib/tasks-query'
import { cn } from '#lib/utils'

const MAX_VISIBLE_VIEWS = 5

interface NavItem {
  to: string
  label: string
  keys: string
  exact?: boolean
}

const navItems: NavItem[] = [
  {
    to: navKeybindings.goToToday.to,
    label: 'Today',
    keys: navKeybindings.goToToday.keys,
  },
  {
    to: navKeybindings.goToCalendar.to,
    label: 'Calendar',
    keys: navKeybindings.goToCalendar.keys,
    exact: true,
  },
  {
    to: navKeybindings.goToTasks.to,
    label: 'Tasks',
    keys: navKeybindings.goToTasks.keys,
  },
  {
    to: navKeybindings.goToProjects.to,
    label: 'Projects',
    keys: navKeybindings.goToProjects.keys,
  },
]

const settingsNavItem: NavItem = {
  to: navKeybindings.goToSettings.to,
  label: 'Settings',
  keys: navKeybindings.goToSettings.keys,
}

// Shared with context-filter.stories.tsx's Sidebar-variant demo, which
// mimics this rail's width without rendering the real Sidebar.
export const SIDEBAR_WIDTH_CLASS = 'w-50'

function NavLink({ item }: { item: NavItem }) {
  const matchRoute = useMatchRoute()
  const isActive =
    matchRoute({ to: item.to, fuzzy: item.exact !== true }) !== false

  return (
    <Link
      to={item.to}
      className={cn(
        'flex items-center gap-2 py-1.5 pr-3.5 pl-3 font-mono text-xs',
        isActive
          ? 'bg-card text-foreground'
          : 'text-muted-foreground hover:bg-card hover:text-foreground',
      )}
    >
      <span
        className={cn(
          'h-3.5 w-0.5 shrink-0',
          isActive ? 'bg-primary' : 'bg-transparent',
        )}
      />
      <span className="flex-1 truncate text-left">{item.label}</span>
      <KeybindHint>{item.keys}</KeybindHint>
    </Link>
  )
}

// Shared row shape for TagLink/ViewLink — both are a full-width link into
// /tasks scoped by a search query, differing only in their prefix/suffix.
function SidebarRowLink({
  search,
  isActive,
  children,
}: {
  search: { q: string }
  isActive: boolean
  children: ReactNode
}) {
  return (
    <Link
      to="/tasks"
      search={search}
      className={cn(
        'group flex w-full items-center gap-2 px-3.5 py-1 text-left font-mono text-2xs',
        isActive
          ? 'bg-card text-foreground'
          : 'text-muted-foreground-strong hover:bg-card hover:text-foreground',
      )}
    >
      {children}
    </Link>
  )
}

function TagLink({
  name,
  count,
  isActive,
}: {
  name: string
  count: number
  isActive: boolean
}) {
  return (
    <SidebarRowLink search={tagFilterSearch(name)} isActive={isActive}>
      <span
        className={cn(
          'font-bold',
          isActive ? 'text-primary' : 'text-muted-foreground-faint',
        )}
      >
        #
      </span>
      <span className="flex-1 truncate text-left">{name}</span>
      <span className="shrink-0 text-muted-foreground-faint">{count}</span>
    </SidebarRowLink>
  )
}

function ViewLink({ view, isActive }: { view: SavedView; isActive: boolean }) {
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const deleteSavedView = useDeleteSavedView()

  return (
    <>
      <SidebarRowLink search={{ q: view.query }} isActive={isActive}>
        <span className="flex-1 truncate text-left">{view.name}</span>
        <ActionsMenu
          aria-label="View actions"
          desktopTriggerClassName="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100"
          items={[
            {
              icon: <Pencil className="h-4 w-4" />,
              label: 'rename…',
              onClick: () => {
                setRenameOpen(true)
              },
            },
            {
              icon: <Trash2 className="h-4 w-4" />,
              label: 'delete…',
              onClick: () => {
                setDeleteOpen(true)
              },
              destructive: true,
            },
          ]}
        />
      </SidebarRowLink>
      <RenameSavedViewDialog
        view={view}
        open={renameOpen}
        onOpenChange={setRenameOpen}
      />
      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete view"
        description={`Are you sure you want to delete "${view.name}"? This action cannot be undone.`}
        onDelete={() => {
          deleteSavedView.mutate(view.id)
        }}
      />
    </>
  )
}

function ViewsSection() {
  const { data: views } = useSavedViews()
  // `q` only exists on the /tasks route's search schema, so this reads
  // undefined (no active view) everywhere else.
  const { q } = useSearch({ strict: false })
  const [isExpanded, setIsExpanded] = useState(false)

  if (views == null || views.length === 0) {
    return null
  }

  const visibleViews = isExpanded ? views : views.slice(0, MAX_VISIBLE_VIEWS)
  const hiddenCount = views.length - MAX_VISIBLE_VIEWS

  return (
    <div className="flex shrink-0 flex-col">
      <div className="flex items-center justify-between px-3.5 pb-1.5">
        <span className="font-mono text-2xs tracking-widest text-muted-foreground-faint">
          VIEWS
        </span>
      </div>
      <div className="flex flex-col">
        {visibleViews.map((view) => (
          <ViewLink key={view.id} view={view} isActive={q === view.query} />
        ))}
        {!isExpanded && hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => {
              setIsExpanded(true)
            }}
            className="px-3.5 py-1 text-left font-mono text-2xs text-muted-foreground-faint hover:text-foreground"
          >
            + {hiddenCount} more
          </button>
        )}
      </div>
    </div>
  )
}

function TagsSection() {
  const { tagCounts } = useTagCounts()
  // `q` only exists on the /tasks route's search schema, so this reads
  // undefined (no active tag) everywhere else.
  const { q } = useSearch({ strict: false })
  const activeTag = q != null ? parseSearchQuery(q).label : undefined

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-3.5 pb-1.5">
        <span className="font-mono text-2xs tracking-widest text-muted-foreground-faint">
          TAGS
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {tagCounts.map((tagCount) => (
          <TagLink
            key={tagCount.name}
            name={tagCount.name}
            count={tagCount.count}
            isActive={activeTag === tagCount.name}
          />
        ))}
      </div>
    </div>
  )
}

function ProjectsSection() {
  const { data: projects } = useProjects()

  return (
    <div className="flex shrink-0 flex-col">
      <div className="flex items-center justify-between px-3.5 pb-1.5">
        <span className="font-mono text-2xs tracking-widest text-muted-foreground-faint">
          PROJECTS
        </span>
        <span className="font-mono text-2xs text-muted-foreground-faint">
          {projects?.length ?? 0}
        </span>
      </div>
      <div className="flex max-h-33 flex-col overflow-y-auto">
        {projects?.map((project) => {
          const status: ProjectStatus = isProjectStatus(project.status)
            ? project.status
            : 'active'
          return (
            <Link
              key={project.id}
              to="/projects/$projectId"
              params={{ projectId: project.id }}
              className="flex items-center gap-2 px-3.5 py-1 font-mono text-2xs text-muted-foreground hover:bg-card hover:text-foreground"
            >
              <ProjectStatusMark status={status} />
              <span className="flex-1 truncate text-left">{project.title}</span>
              <span className="shrink-0 font-mono text-2xs text-muted-foreground-faint">
                {project.taskCount.completed}/{project.taskCount.total}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export function SidebarContent({ footerExtra }: { footerExtra?: ReactNode }) {
  return (
    <>
      <nav className="flex flex-col gap-px py-2">
        {navItems.map((item) => (
          <NavLink key={item.to} item={item} />
        ))}
      </nav>

      <div className="mx-3.5 mt-1.5 mb-2 border-t border-border" />

      <ViewsSection />
      <TagsSection />
      <ProjectsSection />

      <div className="mt-auto border-t border-border">
        {footerExtra}
        <NavLink item={settingsNavItem} />
      </div>
    </>
  )
}

export function Sidebar() {
  return (
    <aside
      className={`hidden h-screen ${SIDEBAR_WIDTH_CLASS} shrink-0 flex-col border-r border-border bg-sidebar md:flex`}
    >
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3.5">
        <Link to="/" className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold text-primary">&gt;</span>
          <span className="font-mono text-sm font-bold tracking-tight text-foreground">
            tq
          </span>
        </Link>
        <span className="ml-auto font-mono text-2xs text-muted-foreground-faint">
          task queue
        </span>
      </div>

      <SidebarContent
        footerExtra={
          <div className="px-2.5 py-2">
            <ContextFilter />
          </div>
        }
      />
    </aside>
  )
}
