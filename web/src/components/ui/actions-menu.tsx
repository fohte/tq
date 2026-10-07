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

function stopEventPropagation(e: React.SyntheticEvent) {
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
  hideDesktopTriggerUntilHover = false,
  'aria-label': ariaLabel = 'Actions',
  defaultOpen,
}: {
  items: ActionsMenuItem[]
  mobileItems?: ActionsMenuItem[]
  desktopTriggerClassName?: string
  mobileTriggerClassName?: string
  hideDesktopTriggerUntilHover?: boolean
  'aria-label'?: string
  defaultOpen?: 'desktop' | 'mobile' | undefined
}) {
  return (
    // Portal events bubble through this React tree. Stop clicks and presses before
    // they reach a row handler.
    <div
      className="contents"
      onClick={stopEventPropagation}
      onMouseDown={stopEventPropagation}
      onPointerDown={stopEventPropagation}
      onTouchStart={stopEventPropagation}
    >
      <DropdownMenu defaultOpen={defaultOpen === 'desktop'}>
        <DropdownMenuTrigger
          aria-label={ariaLabel}
          onClick={stopRowNavigation}
          data-no-dnd=""
          render={
            <button
              type="button"
              className={cn(
                'hidden h-5 w-5 shrink-0 items-center justify-center text-muted-foreground outline-none hover:text-foreground md:flex',
                hideDesktopTriggerUntilHover &&
                  'opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100',
                desktopTriggerClassName,
              )}
            />
          }
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {items.map((item) => (
            <DropdownMenuItem
              key={item.label}
              onClick={item.onClick}
              variant={item.destructive === true ? 'destructive' : 'default'}
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
        <ActionSheet defaultOpen={defaultOpen === 'mobile'}>
          <ActionSheetTrigger
            aria-label={ariaLabel}
            onClick={stopRowNavigation}
            data-no-dnd=""
            render={
              <button
                type="button"
                className={cn(
                  'flex h-11 w-11 shrink-0 items-center justify-center text-muted-foreground outline-none hover:text-foreground md:hidden',
                  mobileTriggerClassName,
                )}
              />
            }
          >
            <MoreHorizontal className="h-4 w-4" />
          </ActionSheetTrigger>
          <ActionSheetContent>
            {mobileItems.map((item) => (
              <ActionSheetItem
                key={item.label}
                icon={item.icon}
                onClick={item.onClick}
                variant={item.destructive === true ? 'destructive' : 'default'}
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
    </div>
  )
}
