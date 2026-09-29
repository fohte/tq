import { Button } from '@fohte/ui/button'
import { Pencil } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'

import { MarkdownEditor } from '#components/ui/markdown-editor'

export function EditableMarkdownDescription({
  header,
  defaultValue,
  placeholder,
  editButtonLabel,
  onChange,
  onExitEditMode,
  initiallyEditing = false,
}: {
  header?: ReactNode
  defaultValue: string | null
  placeholder: string
  editButtonLabel: string
  onChange: (markdown: string) => void
  onExitEditMode: () => void
  initiallyEditing?: boolean
}) {
  const [isEditing, setIsEditing] = useState(initiallyEditing)
  const isEmpty = defaultValue == null || defaultValue.trim() === ''

  return (
    <div className="flex flex-col gap-1.5">
      {(header != null || !isEditing) && (
        <div className="flex items-center gap-2">
          {header}
          {!isEditing && (
            <Button
              type="button"
              variant="outline"
              size="xs"
              aria-label={editButtonLabel}
              className="ml-auto max-md:h-8 max-md:px-3"
              onClick={() => {
                setIsEditing(true)
              }}
            >
              <Pencil className="size-3" />
              edit
            </Button>
          )}
        </div>
      )}
      <div
        className="border border-border p-1 text-sm leading-relaxed focus-within:border-ring"
        onClick={(event) => {
          if (
            !isEditing &&
            isEmpty &&
            event.target instanceof Element &&
            event.target.closest('.milkdown-wrapper') != null
          ) {
            setIsEditing(true)
          }
        }}
      >
        <MarkdownEditor
          defaultValue={defaultValue ?? ''}
          placeholder={placeholder}
          onChange={onChange}
          editing={isEditing}
          onEditingChange={setIsEditing}
          onExitEditMode={onExitEditMode}
          size={isEditing || isEmpty ? 'compact' : 'fit'}
        />
      </div>
    </div>
  )
}
