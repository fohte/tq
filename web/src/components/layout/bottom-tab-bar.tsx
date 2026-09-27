import { Link, useMatchRoute } from '@tanstack/react-router'
import {
  Calendar,
  ListChecks,
  type LucideIcon,
  Menu,
  Plus,
  Search,
  Sun,
} from 'lucide-react'

import { cn } from '#lib/utils'

interface TabItem {
  to: string
  icon: LucideIcon
  label: string
  exact?: boolean
}

const tabs: TabItem[] = [
  { to: '/browse', icon: Menu, label: 'browse' },
  { to: '/today', icon: Sun, label: 'today' },
  { to: '/', icon: Calendar, label: 'calendar', exact: true },
  { to: '/tasks', icon: ListChecks, label: 'tasks' },
]

interface BottomTabBarProps {
  onSearch: () => void
  onNewTask: () => void
}

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

function ActionButton({
  icon: Icon,
  label,
  onClick,
  isPrimary = false,
  hasDivider = false,
}: {
  icon: LucideIcon
  label: string
  onClick: () => void
  isPrimary?: boolean
  hasDivider?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative flex min-h-11 flex-1 cursor-pointer flex-col items-center justify-center gap-1 border-t-2 border-t-transparent',
        isPrimary ? 'text-primary' : 'text-muted-foreground-faint',
      )}
    >
      {hasDivider && (
        <span
          aria-hidden="true"
          className="absolute inset-y-3 left-0 w-px bg-border"
        />
      )}
      <Icon className="size-5" />
      <span className="font-mono text-2xs tracking-wider">{label}</span>
    </button>
  )
}

export function BottomTabBar({ onSearch, onNewTask }: BottomTabBarProps) {
  return (
    <nav className="sticky bottom-0 flex shrink-0 flex-col border-t border-border bg-background md:hidden">
      <div className="flex h-13 items-stretch">
        {tabs.map((tab) => (
          <Tab key={tab.to} tab={tab} />
        ))}
        <ActionButton
          icon={Search}
          label="search"
          onClick={onSearch}
          hasDivider
        />
        <ActionButton icon={Plus} label="new" onClick={onNewTask} isPrimary />
      </div>
    </nav>
  )
}
