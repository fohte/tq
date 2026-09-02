import { Link, useMatchRoute, useSearch } from '@tanstack/react-router'
import { parseSearchQuery } from 'api/search-query-parser'
import { Pencil, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'

import { EditLabelDialog } from '#components/label/edit-label-dialog'
import {
  isProjectStatus,
  type ProjectStatus,
  ProjectStatusMark,
} from '#components/project/project-status-mark'
import { RenameSavedViewDialog } from '#components/saved-view/rename-saved-view-dialog'
import { ActionsMenu } from '#components/ui/actions-menu'
import { DeleteConfirmDialog } from '#components/ui/delete-confirm-dialog'
import { KeybindHint } from '#components/ui/keybind-hint'
import { useCurrentContext } from '#hooks/use-current-context'
import type { Label } from '#hooks/use-labels'
import { useDeleteLabel, useLabels } from '#hooks/use-labels'
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

function SidebarActionableRow({
  search,
  isActive,
  children,
  actionsAriaLabel,
  editItemLabel,
  onEdit,
  deleteTitle,
  deleteDescription,
  onDelete,
}: {
  search: { q: string }
  isActive: boolean
  children: ReactNode
  actionsAriaLabel: string
  editItemLabel: string
  onEdit: () => void
  deleteTitle: string
  deleteDescription: string
  onDelete: () => void
}) {
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <>
      <SidebarRowLink search={search} isActive={isActive}>
        {children}
        <ActionsMenu
          aria-label={actionsAriaLabel}
          desktopTriggerClassName="h-3.5 w-3.5"
          mobileTriggerClassName="h-4 w-4"
          items={[
            {
              icon: <Pencil className="h-4 w-4" />,
              label: editItemLabel,
              onClick: onEdit,
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
      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={deleteTitle}
        description={deleteDescription}
        onDelete={onDelete}
      />
    </>
  )
}

function TagLink({
  label,
  count,
  isActive,
}: {
  label: Label
  count: number
  isActive: boolean
}) {
  const [editOpen, setEditOpen] = useState(false)
  const deleteLabel = useDeleteLabel()

  return (
    <>
      <SidebarActionableRow
        search={tagFilterSearch(label.name)}
        isActive={isActive}
        actionsAriaLabel="Tag actions"
        editItemLabel="edit…"
        onEdit={() => {
          setEditOpen(true)
        }}
        deleteTitle="Delete tag"
        deleteDescription={`Are you sure you want to delete "#${label.name}"? This action cannot be undone.`}
        onDelete={() => {
          deleteLabel.mutate(label.id)
        }}
      >
        <span
          className={cn(
            'font-bold',
            isActive ? 'text-primary' : 'text-muted-foreground-faint',
          )}
        >
          #
        </span>
        <span className="flex-1 truncate text-left">{label.name}</span>
        <span className="shrink-0 text-muted-foreground-faint">{count}</span>
      </SidebarActionableRow>
      <EditLabelDialog
        label={label}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </>
  )
}

function ViewLink({ view, isActive }: { view: SavedView; isActive: boolean }) {
  const [renameOpen, setRenameOpen] = useState(false)
  const deleteSavedView = useDeleteSavedView()

  return (
    <>
      <SidebarActionableRow
        search={{ q: view.query }}
        isActive={isActive}
        actionsAriaLabel="View actions"
        editItemLabel="rename…"
        onEdit={() => {
          setRenameOpen(true)
        }}
        deleteTitle="Delete view"
        deleteDescription={`Are you sure you want to delete "${view.name}"? This action cannot be undone.`}
        onDelete={() => {
          deleteSavedView.mutate(view.id)
        }}
      >
        <span className="flex-1 truncate text-left">{view.name}</span>
      </SidebarActionableRow>
      <RenameSavedViewDialog
        view={view}
        open={renameOpen}
        onOpenChange={setRenameOpen}
      />
    </>
  )
}

function ViewsSection() {
  const context = useCurrentContext()
  const { data: views } = useSavedViews({ context })
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
  const context = useCurrentContext()
  const { tagCounts } = useTagCounts(context)
  // Same queryKey as the one useTagCounts fetches internally, so this reads
  // from cache rather than issuing a second request.
  const { data: labels } = useLabels({ context })
  // `q` only exists on the /tasks route's search schema, so this reads
  // undefined (no active tag) everywhere else.
  const { q } = useSearch({ strict: false })
  const activeTag = q != null ? parseSearchQuery(q).label : undefined

  const labelsByName = new Map(labels?.map((label) => [label.name, label]))

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-3.5 pb-1.5">
        <span className="font-mono text-2xs tracking-widest text-muted-foreground-faint">
          TAGS
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {tagCounts.map((tagCount) => {
          const label = labelsByName.get(tagCount.name)
          if (label == null) return null
          return (
            <TagLink
              key={label.id}
              label={label}
              count={tagCount.count}
              isActive={activeTag === tagCount.name}
            />
          )
        })}
      </div>
    </div>
  )
}

function ProjectsSection() {
  const context = useCurrentContext()
  const { data: projects } = useProjects({ context })

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

export function SidebarContent() {
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
        <NavLink item={settingsNavItem} />
      </div>
    </>
  )
}

export function Sidebar() {
  return (
    <aside className="hidden h-screen w-50 shrink-0 flex-col border-r border-border bg-sidebar md:flex">
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

      <SidebarContent />
    </aside>
  )
}
