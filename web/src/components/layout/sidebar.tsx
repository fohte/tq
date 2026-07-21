import { Link, useMatchRoute } from '@tanstack/react-router'
import { ContextFilter } from '@web/components/context-filter'
import { ColorDot } from '@web/components/project/color-dot'
import { useProjects } from '@web/hooks/use-projects'
import { cn } from '@web/lib/utils'
import type { LucideIcon } from 'lucide-react'
import {
  Calendar,
  CheckSquare,
  FolderKanban,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
  Sun,
} from 'lucide-react'
import { useState } from 'react'

interface NavItem {
  to: string
  icon: LucideIcon
  label: string
  exact?: boolean
}

const navItems: NavItem[] = [
  { to: '/search', icon: Search, label: 'Search' },
  { to: '/tasks', icon: CheckSquare, label: 'Tasks' },
  { to: '/', icon: Calendar, label: 'Calendar', exact: true },
  { to: '/today', icon: Sun, label: 'Today' },
]

function CollapsedNavLink({ item }: { item: NavItem }) {
  const matchRoute = useMatchRoute()
  const isActive = matchRoute({ to: item.to, fuzzy: item.exact !== true })

  return (
    <Link
      to={item.to}
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
        'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        isActive !== false
          ? 'bg-sidebar-accent text-primary'
          : 'text-sidebar-foreground/60',
      )}
      title={item.label}
    >
      <item.icon className="h-5 w-5" />
    </Link>
  )
}

function ExpandedNavLink({ item }: { item: NavItem }) {
  const matchRoute = useMatchRoute()
  const isActive = matchRoute({ to: item.to, fuzzy: item.exact !== true })

  return (
    <Link
      to={item.to}
      className={cn(
        'flex h-10 items-center gap-3 rounded-lg px-4 text-sm transition-colors',
        'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        isActive !== false
          ? 'bg-sidebar-accent text-primary'
          : 'text-sidebar-foreground/60',
      )}
    >
      <item.icon className="h-5 w-5 shrink-0" />
      <span className="truncate">{item.label}</span>
    </Link>
  )
}

function ProjectsSection({ onNewProject }: { onNewProject: () => void }) {
  const { data: projects } = useProjects({ status: 'active' })

  return (
    <div className="flex flex-col gap-1">
      <span className="px-4 text-[10px] font-semibold uppercase text-muted-foreground">
        Projects
      </span>
      {projects?.map((project) => (
        <Link
          key={project.id}
          to="/projects/$projectId"
          params={{ projectId: project.id }}
          className="flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent"
        >
          <ColorDot color={project.color} size={8} />
          <span className="truncate">{project.title}</span>
        </Link>
      ))}
      <button
        type="button"
        onClick={onNewProject}
        className="flex items-center gap-2 px-4 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <Plus className="size-3.5" />
        <span>New</span>
      </button>
    </div>
  )
}

const projectNavItem: NavItem = {
  to: '/projects',
  icon: FolderKanban,
  label: 'Projects',
}

const settingsNavItem: NavItem = {
  to: '/settings',
  icon: Settings,
  label: 'Settings',
}

export function Sidebar({ onNewProject }: { onNewProject?: () => void }) {
  const [expanded, setExpanded] = useState(false)

  if (expanded) {
    return (
      <aside className="hidden md:flex h-screen w-[200px] flex-col border-r border-border bg-sidebar py-4">
        <div className="flex items-center justify-between px-4 mb-4">
          <Link to="/" className="text-lg font-bold text-primary">
            tq
          </Link>
          <button
            type="button"
            onClick={() => {
              setExpanded(false)
            }}
            className="text-sidebar-foreground/60 transition-colors hover:text-foreground"
            title="Collapse sidebar"
          >
            <PanelLeftClose className="size-4" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-2">
          {navItems.map((item) => (
            <ExpandedNavLink key={item.label} item={item} />
          ))}

          <div className="mx-2 my-2 h-px bg-border" />

          <ProjectsSection onNewProject={onNewProject ?? (() => {})} />
        </nav>

        <div className="flex flex-col gap-2 px-2">
          <ExpandedNavLink item={settingsNavItem} />
          <div className="px-2">
            <ContextFilter />
          </div>
        </div>
      </aside>
    )
  }

  return (
    <aside className="hidden md:flex h-screen w-14 flex-col items-center border-r border-border bg-sidebar py-4">
      <Link to="/" className="mb-6 text-lg font-bold text-primary">
        tq
      </Link>

      <nav className="flex flex-1 flex-col items-center gap-2">
        {navItems.map((item) => (
          <CollapsedNavLink key={item.label} item={item} />
        ))}

        <div className="mx-2 my-2 h-px w-8 bg-border" />

        <CollapsedNavLink item={projectNavItem} />

        <button
          type="button"
          onClick={() => {
            setExpanded(true)
          }}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          title="Expand sidebar"
        >
          <PanelLeftOpen className="h-5 w-5" />
        </button>
      </nav>

      <div className="mb-4 flex flex-col items-center gap-2">
        <CollapsedNavLink item={settingsNavItem} />
        <ContextFilter />
      </div>
    </aside>
  )
}
