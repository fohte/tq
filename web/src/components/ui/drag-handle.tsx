import type {
  DraggableAttributes,
  DraggableSyntheticListeners,
} from '@dnd-kit/core'
import { Button } from '@fohte/ui/button'
import { GripVertical } from 'lucide-react'

export function DragHandle({
  attributes,
  listeners,
  'aria-label': ariaLabel,
}: {
  attributes: DraggableAttributes
  listeners: DraggableSyntheticListeners
  'aria-label': string
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      {...attributes}
      {...listeners}
      aria-label={ariaLabel}
      className="touch-none cursor-grab text-muted-foreground active:cursor-grabbing"
    >
      <GripVertical className="h-4 w-4" />
    </Button>
  )
}
