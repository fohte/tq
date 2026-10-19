import {
  BottomNavigation,
  type BottomNavigationItem,
} from '@fohte/ui/bottom-navigation'
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

const itemClassName =
  'w-full border-t-2 bg-transparent [&_[data-slot=bottom-navigation-label]]:font-mono [&_[data-slot=bottom-navigation-label]]:text-2xs [&_[data-slot=bottom-navigation-label]]:tracking-wider'

function getItemColorClassName(selected: boolean) {
  return selected
    ? 'border-t-primary text-foreground hover:text-foreground'
    : 'border-t-transparent text-muted-foreground-faint hover:text-muted-foreground-faint'
}

export function BottomTabBar({ onSearch, onNewTask }: BottomTabBarProps) {
  const matchRoute = useMatchRoute()
  const items = [
    ...tabs.map((tab): BottomNavigationItem => {
      const selected =
        matchRoute({ to: tab.to, fuzzy: tab.exact !== true }) !== false

      return {
        id: tab.to,
        type: 'link',
        label: tab.label,
        icon: <tab.icon className="size-5" />,
        selected,
        className: cn(itemClassName, getItemColorClassName(selected)),
        renderLink: (props) => <Link to={tab.to} {...props} />,
      }
    }),
    {
      id: 'search',
      type: 'button',
      label: 'search',
      icon: <Search className="size-5" />,
      onClick: onSearch,
      className: cn(
        itemClassName,
        getItemColorClassName(false),
        'border-l border-border',
      ),
    },
    {
      id: 'new',
      type: 'button',
      label: 'new',
      icon: <Plus className="size-5" />,
      onClick: onNewTask,
      className: cn(itemClassName, getItemColorClassName(false)),
    },
  ] satisfies ReadonlyArray<BottomNavigationItem>

  return (
    <div className="sticky bottom-0 shrink-0 border-t border-border bg-background md:hidden">
      <BottomNavigation aria-label="Primary navigation" items={items} />
    </div>
  )
}
