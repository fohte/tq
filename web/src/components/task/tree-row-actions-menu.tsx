import { CornerUpLeft, MoreHorizontal, Plus, Search } from 'lucide-react'

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

function stopRowNavigation(e: React.MouseEvent) {
  e.preventDefault()
  e.stopPropagation()
}

export function TreeRowActionsMenu({
  triggerClassName,
  onAddSubtask,
  onLinkExisting,
  onMoveUnder,
}: {
  triggerClassName?: string
  onAddSubtask: () => void
  onLinkExisting: () => void
  onMoveUnder: () => void
}) {
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Task actions"
          onClick={stopRowNavigation}
          className={cn(
            'hidden h-5 w-5 shrink-0 items-center justify-center text-muted-foreground opacity-0 outline-none group-hover:opacity-100 focus-visible:opacity-100 hover:text-foreground data-popup-open:opacity-100 md:flex',
            triggerClassName,
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
          <DropdownMenuItem onClick={onAddSubtask}>
            <Plus />
            add subtask
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onLinkExisting}>
            <Search />
            link existing task…
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onMoveUnder}>
            <CornerUpLeft />
            move under…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ActionSheet>
        <ActionSheetTrigger
          aria-label="Task actions"
          onClick={stopRowNavigation}
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center text-muted-foreground outline-none hover:text-foreground md:hidden',
            triggerClassName,
          )}
        >
          <MoreHorizontal className="h-4 w-4" />
        </ActionSheetTrigger>
        <ActionSheetContent
          onClick={(e) => {
            e.stopPropagation()
          }}
        >
          <ActionSheetItem
            icon={<Plus className="h-4 w-4" />}
            onClick={onAddSubtask}
          >
            add subtask
          </ActionSheetItem>
          <ActionSheetItem
            icon={<Search className="h-4 w-4" />}
            onClick={onLinkExisting}
          >
            link existing task…
          </ActionSheetItem>
          <ActionSheetItem
            icon={<CornerUpLeft className="h-4 w-4" />}
            onClick={onMoveUnder}
          >
            move under…
          </ActionSheetItem>
        </ActionSheetContent>
      </ActionSheet>
    </>
  )
}
