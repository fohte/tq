import { StatusIcon } from '#components/task/status-icon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '#components/ui/dropdown-menu'
import type { Task } from '#hooks/use-tasks'

const STATUS_OPTIONS: { value: Task['status']; label: string }[] = [
  { value: 'todo', label: 'Todo' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
]

export function TaskStatusPicker({
  status,
  onStatusChange,
}: {
  status: Task['status']
  onStatusChange: (status: Task['status']) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Change task status"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
        data-no-dnd=""
        className="flex shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <StatusIcon status={status} />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        onClick={(e) => {
          e.stopPropagation()
        }}
      >
        <DropdownMenuRadioGroup value={status} onValueChange={onStatusChange}>
          {STATUS_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
