import { Button } from '@fohte/ui/button'
import { Pencil } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'

import { MarkdownEditor } from '#components/ui/markdown-editor'
import { cn } from '#lib/utils'

export function EditableMarkdownDescription({
  header,
  variant = 'task',
  defaultValue,
  placeholder,
  editButtonLabel,
  onChange,
  onExitEditMode,
  initiallyEditing = false,
}: {
  header?: ReactNode
  variant?: 'task' | 'project'
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
              variant="ghost"
              size="icon"
              aria-label={editButtonLabel}
              className="ml-auto h-11 w-11 shrink-0 p-0 text-muted-foreground hover:bg-transparent hover:text-foreground active:translate-y-0 md:h-5 md:w-5"
              onClick={() => {
                setIsEditing(true)
              }}
            >
              <Pencil className="h-4 w-4 md:h-3.5 md:w-3.5" />
            </Button>
          )}
        </div>
      )}
      <div
        className={cn(
          'border border-border text-sm leading-relaxed',
          variant === 'task' && 'p-4 focus-within:border-ring',
          variant === 'project' &&
            'px-1 pb-1 pt-3 focus-within:border-primary/50',
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
