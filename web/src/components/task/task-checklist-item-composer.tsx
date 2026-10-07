import { Input } from '@fohte/ui/input'
import { useState } from 'react'

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
      className="flex min-h-10 items-center px-3 py-1"
      style={{ paddingLeft: `${String(36 + depth * 20)}px` }}
    >
      <Input
        aria-label="New checklist item"
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
        className="h-7 min-w-0 border-0 px-1 py-0 font-mono text-xs shadow-none focus-visible:ring-1"
      />
    </div>
  )
}
