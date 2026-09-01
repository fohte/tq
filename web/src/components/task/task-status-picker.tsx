import { StatusIcon } from '#components/task/status-icon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '#components/ui/dropdown-menu'
import type { Task } from '#hooks/use-tasks'

// 'completed' does double duty here: it's both a Task['status'] value and
// the default Task['statusReason'] value, so a single flat union of the 4
// picker options covers every case without a separate compound type.
export type StatusPickerValue =
  'todo' | 'completed' | 'not_planned' | 'duplicate'

const STATUS_OPTIONS: { value: 'todo'; label: string }[] = [
  { value: 'todo', label: 'Todo' },
]

const CLOSE_REASON_OPTIONS: {
  value: 'completed' | 'not_planned' | 'duplicate'
  label: string
}[] = [
  { value: 'completed', label: 'Completed' },
  { value: 'not_planned', label: 'Not planned' },
  { value: 'duplicate', label: 'Duplicate' },
]

export function TaskStatusPicker({
  status,
  statusReason,
  onValueChange,
}: {
  status: Task['status']
  statusReason: Task['statusReason']
  onValueChange: (value: StatusPickerValue) => void
}) {
  const value: StatusPickerValue =
    status === 'completed' ? (statusReason ?? 'completed') : 'todo'

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
        <StatusIcon status={status} statusReason={statusReason} />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        onClick={(e) => {
          e.stopPropagation()
        }}
      >
        <DropdownMenuRadioGroup value={value} onValueChange={onValueChange}>
          {STATUS_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              <StatusIcon status={option.value} statusReason={null} />
              {option.label}
            </DropdownMenuRadioItem>
          ))}
          <DropdownMenuGroup>
            <DropdownMenuLabel>Close as</DropdownMenuLabel>
            {CLOSE_REASON_OPTIONS.map((option) => (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                <StatusIcon status="completed" statusReason={option.value} />
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
