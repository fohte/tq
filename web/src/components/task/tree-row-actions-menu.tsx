import { CornerUpLeft, FolderInput, Plus, Search, Trash2 } from 'lucide-react'

import { ActionsMenu } from '#components/ui/actions-menu'

export function TreeRowActionsMenu({
  onAddSubtask,
  onLinkExisting,
  onMoveUnder,
  onSetProject,
  onDelete,
}: {
  onAddSubtask: () => void
  onLinkExisting: () => void
  onMoveUnder: () => void
  onSetProject: () => void
  onDelete: () => void
}) {
  return (
    <ActionsMenu
      desktopTriggerClassName="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100"
      items={[
        {
          icon: <Plus className="h-4 w-4" />,
          label: 'add subtask',
          onClick: onAddSubtask,
        },
        {
          icon: <Search className="h-4 w-4" />,
          label: 'link existing task…',
          onClick: onLinkExisting,
        },
        {
          icon: <CornerUpLeft className="h-4 w-4" />,
          label: 'move under…',
          onClick: onMoveUnder,
        },
        {
          icon: <FolderInput className="h-4 w-4" />,
          label: 'set project…',
          onClick: onSetProject,
        },
        {
          icon: <Trash2 className="h-4 w-4" />,
          label: 'delete…',
          onClick: onDelete,
          destructive: true,
        },
      ]}
    />
  )
}
