import { Link, useMatchRoute } from '@tanstack/react-router'
import {
  Calendar,
  FolderKanban,
  ListChecks,
  type LucideIcon,
  Settings,
  Sun,
} from 'lucide-react'

import { ContextFilterInline } from '#components/context-filter'
import { cn } from '#lib/utils'

interface TabItem {
  to: string
  icon: LucideIcon
  label: string
  exact?: boolean
}

const tabs: TabItem[] = [
  { to: '/today', icon: Sun, label: 'today' },
  { to: '/', icon: Calendar, label: 'calendar', exact: true },
  { to: '/tasks', icon: ListChecks, label: 'tasks' },
  { to: '/projects', icon: FolderKanban, label: 'projects' },
  { to: '/settings', icon: Settings, label: 'settings' },
]

function Tab({ tab }: { tab: TabItem }) {
  const matchRoute = useMatchRoute()
  const isActive =
    matchRoute({ to: tab.to, fuzzy: tab.exact !== true }) !== false

  return (
    <Link
      to={tab.to}
      className={cn(
        'flex min-h-11 flex-1 flex-col items-center justify-center gap-1 border-t-2',
        isActive
          ? 'border-t-primary text-foreground'
          : 'border-t-transparent text-muted-foreground-faint',
      )}
    >
      <tab.icon className="size-5" />
      <span className="font-mono text-2xs tracking-wider">{tab.label}</span>
    </Link>
  )
}

// Context is global state (also read by the sessions page), so it lives in
// app chrome rather than the tasks page's own filter row. Desktop has room
// for it in the sidebar footer; below md, this bar is the only chrome that's
// always on screen, so it goes here instead.
export function BottomTabBar() {
  return (
    <nav className="flex shrink-0 flex-col border-t border-border bg-background md:hidden">
      <div className="flex items-center justify-center gap-1.5 border-b border-border px-2.5 py-1.5">
        <ContextFilterInline />
      </div>
      <div className="flex h-13 items-stretch">
        {tabs.map((tab) => (
          <Tab key={tab.to} tab={tab} />
        ))}
      </div>
    </nav>
  )
}
