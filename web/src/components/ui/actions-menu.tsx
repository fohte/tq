import { MoreHorizontal } from 'lucide-react'
import type { ReactNode } from 'react'

import {
  ActionSheet,
  ActionSheetContent,
  ActionSheetItem,
  ActionSheetTrigger,
} from '#components/ui/action-sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#components/ui/dropdown-menu'
import { cn } from '#lib/utils'

export interface ActionsMenuItem {
  icon: ReactNode
  label: string
  onClick: () => void
  destructive?: boolean
}

function stopRowNavigation(e: React.MouseEvent) {
  e.preventDefault()
  e.stopPropagation()
}

// The same items rendered twice: a dropdown on desktop and a bottom action
// sheet on touch, picked by the `hidden md:flex` / `flex md:hidden` split.
export function ActionsMenu({
  items,
  desktopTriggerClassName,
}: {
  items: ActionsMenuItem[]
  desktopTriggerClassName?: string
}) {
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Task actions"
          onClick={stopRowNavigation}
          data-no-dnd=""
          className={cn(
            'hidden h-5 w-5 shrink-0 items-center justify-center text-muted-foreground outline-none hover:text-foreground md:flex',
            desktopTriggerClassName,
          )}
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          // The trigger sits at the row's far right, so align the menu to
          // its right edge instead of overflowing further right.
          align="end"
          onClick={(e) => {
            e.stopPropagation()
          }}
        >
          {items.map((item) => (
            <DropdownMenuItem
              key={item.label}
              onClick={item.onClick}
              className={cn(
                item.destructive === true &&
                  'text-destructive focus:bg-destructive/10 focus:text-destructive focus:**:text-destructive',
              )}
            >
              {item.icon}
              {item.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <ActionSheet>
        <ActionSheetTrigger
          aria-label="Task actions"
          onClick={stopRowNavigation}
          data-no-dnd=""
          className="flex h-11 w-11 shrink-0 items-center justify-center text-muted-foreground outline-none hover:text-foreground md:hidden"
        >
          <MoreHorizontal className="h-4 w-4" />
        </ActionSheetTrigger>
        <ActionSheetContent
          onClick={(e) => {
            e.stopPropagation()
          }}
        >
          {items.map((item) => (
            <ActionSheetItem
              key={item.label}
              icon={item.icon}
              onClick={item.onClick}
              className={cn(item.destructive === true && 'text-destructive')}
            >
              {item.label}
            </ActionSheetItem>
          ))}
        </ActionSheetContent>
      </ActionSheet>
    </>
  )
}
