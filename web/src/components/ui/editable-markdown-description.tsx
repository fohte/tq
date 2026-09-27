import { Button } from '@fohte/ui/button'
import { Pencil } from 'lucide-react'
import { useState } from 'react'

import { MarkdownEditor } from '#components/ui/markdown-editor'
import { cn } from '#lib/utils'

export function EditableMarkdownDescription({
  defaultValue,
  placeholder,
  editButtonLabel,
  onChange,
  onExitEditMode,
  className,
  initiallyEditing = false,
}: {
  defaultValue: string | null
  placeholder: string
  editButtonLabel: string
  onChange: (markdown: string) => void
  onExitEditMode: () => void
  className?: string
  initiallyEditing?: boolean
}) {
  const [isEditing, setIsEditing] = useState(initiallyEditing)
  const isEmpty = defaultValue == null || defaultValue.trim() === ''

  return (
    <div
      className={cn('border border-border text-sm leading-relaxed', className)}
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
      {!isEditing && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={editButtonLabel}
            onClick={() => {
              setIsEditing(true)
            }}
            className="h-11 w-11 opacity-100 transition-opacity hover:bg-transparent active:translate-y-0 md:h-7 md:w-7 md:opacity-40 md:hover:opacity-100 md:focus-visible:opacity-100"
          >
            <Pencil className="size-4" />
          </Button>
        </div>
      )}
      <MarkdownEditor
        defaultValue={defaultValue ?? ''}
        placeholder={placeholder}
        onChange={onChange}
        viewEditToggle={{ onExitEditMode }}
        editing={isEditing}
        onEditingChange={setIsEditing}
        size="compact"
      />
    </div>
  )
}
