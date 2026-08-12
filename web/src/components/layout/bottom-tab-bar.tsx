import { Link, useMatchRoute } from '@tanstack/react-router'

import { cn } from '#lib/utils'

interface TabItem {
  to: string
  glyph: string
  label: string
  exact?: boolean
}

const tabs: TabItem[] = [
  { to: '/today', glyph: '◆', label: 'today' },
  { to: '/', glyph: '▤', label: 'calendar', exact: true },
  { to: '/tasks', glyph: '≡', label: 'tasks' },
  { to: '/projects', glyph: '▚', label: 'projects' },
  { to: '/settings', glyph: '⚙', label: 'settings' },
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
      <span className="font-mono text-sm leading-none">{tab.glyph}</span>
      <span className="font-mono text-2xs tracking-wider">{tab.label}</span>
    </Link>
  )
}

export function BottomTabBar() {
  return (
    <nav className="flex h-[52px] shrink-0 items-stretch border-t border-border bg-background md:hidden">
      {tabs.map((tab) => (
        <Tab key={tab.to} tab={tab} />
      ))}
    </nav>
  )
}
