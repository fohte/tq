import { Link, useMatchRoute } from '@tanstack/react-router'

import { ContextFilter } from '#components/context-filter'
import {
  isProjectStatus,
  type ProjectStatus,
  ProjectStatusMark,
} from '#components/project/project-status-mark'
import { KeybindHint } from '#components/ui/keybind-hint'
import { useProjects } from '#hooks/use-projects'
import { useTagCounts } from '#hooks/use-tag-counts'
import { useTagFilter, useTagToggle } from '#hooks/use-tag-filter'
import { navKeybindings, searchKeybinding } from '#lib/keybindings'
import { cn } from '#lib/utils'

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
  { to: '/search', label: 'Search', keys: searchKeybinding.keys },
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
        'flex items-center gap-2 border-l-2 py-1.5 pr-3.5 pl-3 font-mono text-xs',
        isActive
          ? 'border-l-primary bg-card text-foreground'
          : 'border-l-transparent text-muted-foreground hover:bg-card hover:text-foreground',
      )}
    >
      <span className="flex-1 truncate text-left">{item.label}</span>
      <KeybindHint>{item.keys}</KeybindHint>
    </Link>
  )
}

function TagButton({ name, count }: { name: string; count: number }) {
  const { isActive, toggle } = useTagToggle(name)

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={isActive}
      className={cn(
        'flex w-full items-center gap-2 px-3.5 py-1 text-left font-mono text-[11px]',
        isActive
          ? 'bg-card text-foreground'
          : 'text-muted-foreground-strong hover:bg-card hover:text-foreground',
      )}
    >
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
    </button>
  )
}

function TagsSection() {
  const { tagCounts } = useTagCounts()
  const { tag, setTag } = useTagFilter()

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-3.5 pb-1.5">
        <span className="font-mono text-[10px] tracking-[0.08em] text-muted-foreground-faint">
          TAGS
        </span>
        {tag != null && (
          <button
            type="button"
            onClick={() => {
              setTag(null)
            }}
            className="font-mono text-[10px] text-muted-foreground-faint hover:text-foreground"
          >
            clear ×
          </button>
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {tagCounts.map((tagCount) => (
          <TagButton
            key={tagCount.name}
            name={tagCount.name}
            count={tagCount.count}
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
        <span className="font-mono text-[10px] tracking-[0.08em] text-muted-foreground-faint">
          PROJECTS
        </span>
        <span className="font-mono text-[10px] text-muted-foreground-faint">
          {projects?.length ?? 0}
        </span>
      </div>
      <div className="flex max-h-[132px] flex-col overflow-y-auto">
        {projects?.map((project) => {
          const status: ProjectStatus = isProjectStatus(project.status)
            ? project.status
            : 'active'
          return (
            <Link
              key={project.id}
              to="/projects/$projectId"
              params={{ projectId: project.id }}
              className="flex items-center gap-2 px-3.5 py-1 font-mono text-[11px] text-muted-foreground hover:bg-card hover:text-foreground"
            >
              <ProjectStatusMark status={status} />
              <span className="flex-1 truncate text-left">{project.title}</span>
              <span className="shrink-0 font-mono text-[10px] text-muted-foreground-faint">
                {project.taskCount.completed}/{project.taskCount.total}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export function Sidebar() {
  return (
    <aside className="hidden h-screen w-[200px] shrink-0 flex-col border-r border-border bg-sidebar md:flex">
      <div className="flex h-[41px] shrink-0 items-center gap-[7px] border-b border-border px-3.5">
        <Link to="/" className="flex items-center gap-[7px]">
          <span className="font-mono text-sm font-bold text-primary">&gt;</span>
          <span className="font-mono text-sm font-bold tracking-tight text-foreground">
            tq
          </span>
        </Link>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground-faint">
          task queue
        </span>
      </div>

      <nav className="flex flex-col gap-px py-2">
        {navItems.map((item) => (
          <NavLink key={item.to} item={item} />
        ))}
      </nav>

      <div className="mx-3.5 mt-1.5 mb-2 border-t border-border" />

      <TagsSection />
      <ProjectsSection />

      <div className="mt-auto border-t border-border">
        <div className="px-2.5 py-2">
          <ContextFilter />
        </div>
        <NavLink item={settingsNavItem} />
      </div>
    </aside>
  )
}
