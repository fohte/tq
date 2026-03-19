import { Link, useMatchRoute } from '@tanstack/react-router'
import { cn } from '@web/lib/utils'
import type { LucideIcon } from 'lucide-react'
import { Calendar, CheckSquare, FolderKanban, Sun } from 'lucide-react'

interface TabItem {
  to: string
  icon: LucideIcon
  label: string
  exact?: boolean
}

const tabs: TabItem[] = [
  { to: '/tasks', icon: CheckSquare, label: 'Tasks' },
  { to: '/', icon: Calendar, label: 'Calendar', exact: true },
  { to: '/projects', icon: FolderKanban, label: 'Projects' },
  { to: '/today', icon: Sun, label: 'Today' },
]

function Tab({ tab }: { tab: TabItem }) {
  const matchRoute = useMatchRoute()
  const isActive = matchRoute({ to: tab.to, fuzzy: !tab.exact })

  return (
    <Link
      to={tab.to}
      className={cn(
        'flex flex-col items-center justify-center gap-0.5 px-3 py-1',
        isActive ? 'text-primary' : 'text-muted-foreground',
      )}
    >
      <tab.icon className="h-5 w-5" />
      <span className="text-xs">{tab.label}</span>
    </Link>
  )
}

export function BottomTabBar() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-14 items-center justify-around border-t border-border bg-background md:hidden">
      {tabs.map((tab) => (
        <Tab key={tab.label} tab={tab} />
      ))}
    </nav>
  )
}
