import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  CornerDownRight,
  CornerUpLeft,
  GitPullRequest,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'

import type { ActionsMenuItem } from '#components/ui/actions-menu'
import type {
  MoveTaskChecklistItemInput,
  TaskChecklistItem,
} from '#hooks/use-task-checklists'

interface CreateChecklistItemActionsInput {
  item: TaskChecklistItem
  index: number
  nextSibling: TaskChecklistItem | undefined
  previousBeforeItem: TaskChecklistItem | undefined
  indentMove: MoveTaskChecklistItemInput | undefined
  outdentMove: MoveTaskChecklistItemInput | undefined
  canLinkOrPromote: boolean
  onEdit: () => void
  onAddSubitem: () => void
  onLinkGithub: () => void
  onPromote: () => void
  onEditDetails: () => void
  onMoveItem: (itemId: string, input: MoveTaskChecklistItemInput) => void
  onDelete: () => void
}

export function createChecklistItemActions({
  item,
  index,
  nextSibling,
  previousBeforeItem,
  indentMove,
  outdentMove,
  canLinkOrPromote,
  onEdit,
  onAddSubitem,
  onLinkGithub,
  onPromote,
  onEditDetails,
  onMoveItem,
  onDelete,
}: CreateChecklistItemActionsInput): ActionsMenuItem[] {
  return [
    {
      icon: <Pencil className="size-4" />,
      label: 'edit',
      onClick: onEdit,
    },
    ...(item.githubLinkId == null && item.subtaskId == null
      ? [
          {
            icon: <Plus className="size-4" />,
            label: 'add subitem',
            onClick: onAddSubitem,
          },
        ]
      : []),
    ...(canLinkOrPromote
      ? [
          {
            icon: <GitPullRequest className="size-4" />,
            label: 'link pull request',
            onClick: onLinkGithub,
          },
          {
            icon: <ArrowUpRight className="size-4" />,
            label: 'promote to subtask',
            onClick: onPromote,
          },
        ]
      : []),
    {
      icon: <Pencil className="size-4" />,
      label:
        item.note == null || item.note === '' ? 'add details' : 'edit details',
      onClick: onEditDetails,
    },
    ...(index > 0
      ? [
          {
            icon: <ArrowUp className="size-4" />,
            label: 'move up',
            onClick: () => {
              onMoveItem(item.id, {
                parentItemId: item.parentItemId,
                afterItemId: previousBeforeItem?.id ?? null,
              })
            },
          },
        ]
      : []),
    ...(nextSibling != null
      ? [
          {
            icon: <ArrowDown className="size-4" />,
            label: 'move down',
            onClick: () => {
              onMoveItem(item.id, {
                parentItemId: item.parentItemId,
                afterItemId: nextSibling.id,
              })
            },
          },
        ]
      : []),
    ...(indentMove != null
      ? [
          {
            icon: <CornerDownRight className="size-4" />,
            label: 'indent',
            onClick: () => {
              onMoveItem(item.id, indentMove)
            },
          },
        ]
      : []),
    ...(outdentMove != null
      ? [
          {
            icon: <CornerUpLeft className="size-4" />,
            label: 'outdent',
            onClick: () => {
              onMoveItem(item.id, outdentMove)
            },
          },
        ]
      : []),
    {
      icon: <Trash2 className="size-4" />,
      label: 'delete…',
      onClick: onDelete,
      destructive: true,
    },
  ]
}
