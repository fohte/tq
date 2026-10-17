import { Input } from '@fohte/ui/input'
import type {
  ChangeEventHandler,
  FocusEventHandler,
  KeyboardEventHandler,
} from 'react'

interface ChecklistItemContentInputProps {
  itemContent: string
  value: string
  onChange: ChangeEventHandler<HTMLInputElement>
  onBlur: FocusEventHandler<HTMLInputElement>
  onKeyDown: KeyboardEventHandler<HTMLInputElement>
}

export function ChecklistItemContentInput({
  itemContent,
  value,
  onChange,
  onBlur,
  onKeyDown,
}: ChecklistItemContentInputProps) {
  return (
    <Input
      aria-label={`Edit ${itemContent}`}
      variant="ghost"
      autoFocus
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      className="h-7 min-w-0 w-full mx-0"
    />
  )
}
