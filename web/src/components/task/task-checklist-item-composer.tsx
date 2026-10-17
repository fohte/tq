import { Input } from '@fohte/ui/input'
import { useState } from 'react'

import {
  type ChecklistIndentStyle,
  getChecklistIndent,
} from '#components/task/checklist-indent-style'

export function ChecklistItemComposer({
  depth,
  onSave,
  onCancel,
}: {
  depth: number
  onSave: (content: string) => void
  onCancel: () => void
}) {
  const [content, setContent] = useState('')

  const save = () => {
    const trimmed = content.trim()
    if (trimmed.length > 0) onSave(trimmed)
    else onCancel()
  }

  return (
    <div
      className="flex min-h-10 items-center py-1 pl-(--checklist-indent) pr-3"
      style={
        {
          '--checklist-indent': getChecklistIndent(36 + depth * 20),
        } as ChecklistIndentStyle
      }
    >
      <Input
        aria-label="New checklist item"
        variant="ghost"
        autoFocus
        value={content}
        onChange={(event) => {
          setContent(event.currentTarget.value)
        }}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return

          if (event.key === 'Enter') event.currentTarget.blur()
          if (event.key === 'Escape') {
            onCancel()
          }
        }}
        placeholder="Item title"
        className="h-7 min-w-0"
      />
    </div>
  )
}
