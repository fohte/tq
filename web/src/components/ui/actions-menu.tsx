import { Check, MoreHorizontal } from 'lucide-react'
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
  /** Renders a checkmark, for an item that's one of a set of mutually
   * exclusive choices (e.g. a layout picker) rather than a one-off action. */
  selected?: boolean
}

function stopRowNavigation(e: React.MouseEvent) {
  e.preventDefault()
  e.stopPropagation()
}

// The same items rendered twice: a dropdown on desktop and a bottom action
// sheet on touch, picked by the `hidden md:flex` / `flex md:hidden` split.
// `mobileItems` lets the two diverge (e.g. an item that's hidden on mobile
// under some condition that doesn't apply on desktop) — it defaults to
// `items` and, when empty, the mobile trigger itself doesn't render, so a
// user never opens a sheet with nothing in it.
export function ActionsMenu({
  items,
  mobileItems = items,
  desktopTriggerClassName,
  mobileTriggerClassName,
  'aria-label': ariaLabel = 'Actions',
}: {
  items: ActionsMenuItem[]
  mobileItems?: ActionsMenuItem[]
  desktopTriggerClassName?: string
  mobileTriggerClassName?: string
  'aria-label'?: string
}) {
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={ariaLabel}
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
              {item.selected === true && (
                <Check className="ml-auto h-3.5 w-3.5" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {mobileItems.length > 0 && (
        <ActionSheet>
          <ActionSheetTrigger
            aria-label={ariaLabel}
            onClick={stopRowNavigation}
            data-no-dnd=""
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center text-muted-foreground outline-none hover:text-foreground md:hidden',
              mobileTriggerClassName,
            )}
          >
            <MoreHorizontal className="h-4 w-4" />
          </ActionSheetTrigger>
          <ActionSheetContent
            onClick={(e) => {
              e.stopPropagation()
            }}
          >
            {mobileItems.map((item) => (
              <ActionSheetItem
                key={item.label}
                icon={item.icon}
                onClick={item.onClick}
                className={cn(item.destructive === true && 'text-destructive')}
              >
                {item.label}
                {item.selected === true && (
                  <Check className="ml-auto h-4 w-4" />
                )}
              </ActionSheetItem>
            ))}
          </ActionSheetContent>
        </ActionSheet>
      )}
    </>
  )
}
