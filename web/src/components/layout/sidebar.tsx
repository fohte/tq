import type { LucideIcon } from 'lucide-react'
import { Link, useMatchRoute } from '@tanstack/react-router'
import { Calendar, CheckSquare, FolderKanban, Search, Sun } from 'lucide-react'

import { cn } from '@web/lib/utils'

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
  { to: '/', icon: Sun, label: 'Today', exact: true },
]

function NavLink({ item }: { item: NavItem }) {
  const matchRoute = useMatchRoute()
  const isActive = matchRoute({ to: item.to, fuzzy: !item.exact })

  return (
    <Link
      to={item.to}
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
        'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        isActive
          ? 'bg-sidebar-accent text-primary'
          : 'text-sidebar-foreground/60',
      )}
      title={item.label}
    >
      <item.icon className="h-5 w-5" />
    </Link>
  )
}

const projectNavItem: NavItem = {
  to: '/projects',
  icon: FolderKanban,
  label: 'Projects',
}

export function Sidebar() {
  return (
    <aside className="hidden md:flex h-screen w-14 flex-col items-center border-r border-border bg-sidebar py-4">
      <Link to="/" className="mb-6 text-lg font-bold text-primary">
        tq
      </Link>

      <nav className="flex flex-1 flex-col items-center gap-2">
        {navItems.map((item) => (
          <NavLink key={item.label} item={item} />
        ))}

        <div className="mx-2 my-2 h-px w-8 bg-border" />

        <NavLink item={projectNavItem} />
      </nav>
    </aside>
  )
}
