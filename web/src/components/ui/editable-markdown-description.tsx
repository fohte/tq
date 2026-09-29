import { Pencil } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'

import { MarkdownEditor } from '#components/ui/markdown-editor'
import { cn } from '#lib/utils'

export function EditableMarkdownDescription({
  surface,
  header,
  defaultValue,
  placeholder,
  editButtonLabel,
  onChange,
  onExitEditMode,
  initiallyEditing = false,
}: {
  surface: 'task' | 'project'
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
      {header}
      <div
        className={cn(
          'relative border border-border text-sm leading-relaxed',
          surface === 'task'
            ? 'p-4 focus-within:border-ring'
            : 'px-1 pb-1 pt-3 focus-within:border-primary/50',
        )}
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
          <button
            type="button"
            aria-label={editButtonLabel}
            className="absolute -top-6 right-0 flex h-11 w-11 items-end justify-end p-1 text-muted-foreground outline-none hover:text-foreground md:top-0 md:h-5 md:w-5 md:items-center md:justify-center md:p-0"
            onClick={() => {
              setIsEditing(true)
            }}
          >
            <Pencil className="h-4 w-4 md:h-3.5 md:w-3.5" />
          </button>
        )}
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
