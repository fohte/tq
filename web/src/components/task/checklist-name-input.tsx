import { Input } from '@fohte/ui/input'
import type {
  ChangeEventHandler,
  FocusEventHandler,
  KeyboardEventHandler,
} from 'react'

interface ChecklistNameInputProps {
  value: string
  onChange: ChangeEventHandler<HTMLInputElement>
  onBlur: FocusEventHandler<HTMLInputElement>
  onKeyDown: KeyboardEventHandler<HTMLInputElement>
}

export function ChecklistNameInput({
  value,
  onChange,
  onBlur,
  onKeyDown,
}: ChecklistNameInputProps) {
  return (
    <Input
      aria-label="Checklist name"
      variant="ghost"
      autoFocus
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      className="h-6 min-w-0 max-w-sm"
    />
  )
}
