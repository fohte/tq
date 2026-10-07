import { Button } from '@fohte/ui/button'
import { Input } from '@fohte/ui/input'
import { Link } from '@tanstack/react-router'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  ChevronDown,
  CornerDownRight,
  CornerUpLeft,
  GitPullRequest,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import type { KeyboardEvent } from 'react'
import { useEffect, useState } from 'react'

import { ChecklistItemGithubLinkDialog } from '#components/task/checklist-item-github-link-dialog'
import { GithubLinkBadge } from '#components/task/github-link-badge'
import { ChecklistItemComposer } from '#components/task/task-checklist-item-composer'
import { ActionsMenu } from '#components/ui/actions-menu'
import { Checkbox } from '#components/ui/checkbox'
import { DeleteConfirmDialog } from '#components/ui/delete-confirm-dialog'
import { MarkdownEditor } from '#components/ui/markdown-editor'
import { useDebouncedSave } from '#hooks/use-debounced-save'
import type { GithubLink } from '#hooks/use-github-link'
import type {
  MoveTaskChecklistItemInput,
  TaskChecklistItem,
  UpdateTaskChecklistItemInput,
} from '#hooks/use-task-checklists'
import type { Task } from '#hooks/use-tasks'
import { countChecklistLeaves } from '#lib/task-checklist-tree'

interface TaskChecklistItemTreeProps {
  items: TaskChecklistItem[]
  githubLinks: GithubLink[]
  subtasks: Task[]
  parentItem?: TaskChecklistItem | undefined
  depth?: number
  addingItemParentId: string | null | undefined
  onCancelAddingItem: () => void
  onCreateItem: (content: string, parentItemId: string | null) => void
  onUpdateItem: (itemId: string, input: UpdateTaskChecklistItemInput) => void
  onDeleteItem: (itemId: string) => void
  onMoveItem: (itemId: string, input: MoveTaskChecklistItemInput) => void
  onSetItemChecked: (itemId: string, checked: boolean) => void
  onLinkGithub: (itemId: string, url: string) => void
  onPromoteItem: (itemId: string) => void
  onStartAddingItem: (parentItemId: string) => void
  initiallyCollapsedItemIds?: string[] | undefined
}

export function TaskChecklistItemTree({
  items,
  githubLinks,
  subtasks,
  parentItem,
  depth = 0,
  addingItemParentId,
  onCancelAddingItem,
  onCreateItem,
  onUpdateItem,
  onDeleteItem,
  onMoveItem,
  onSetItemChecked,
  onLinkGithub,
  onPromoteItem,
  onStartAddingItem,
  initiallyCollapsedItemIds = [],
}: TaskChecklistItemTreeProps) {
  const currentParentId = parentItem?.id ?? null

  return (
    <>
      {items.map((item, index) => (
        <ChecklistItemRow
          key={item.id}
          item={item}
          githubLinks={githubLinks}
          subtasks={subtasks}
          siblings={items}
          index={index}
          parentItem={parentItem}
          depth={depth}
          onUpdateItem={onUpdateItem}
          onDeleteItem={onDeleteItem}
          onMoveItem={onMoveItem}
          onSetItemChecked={onSetItemChecked}
          onLinkGithub={onLinkGithub}
          onPromoteItem={onPromoteItem}
          onStartAddingItem={onStartAddingItem}
          addingItemParentId={addingItemParentId}
          onCancelAddingItem={onCancelAddingItem}
          onCreateItem={onCreateItem}
          initiallyCollapsedItemIds={initiallyCollapsedItemIds}
        />
      ))}
      {addingItemParentId === currentParentId && (
        <ChecklistItemComposer
          depth={depth}
          onSave={(content) => {
            onCreateItem(content, currentParentId)
          }}
          onCancel={onCancelAddingItem}
        />
      )}
    </>
  )
}

function ChecklistItemRow({
  item,
  githubLinks,
  subtasks,
  siblings,
  index,
  parentItem,
  depth,
  onUpdateItem,
  onDeleteItem,
  onMoveItem,
  onSetItemChecked,
  onLinkGithub,
  onPromoteItem,
  onStartAddingItem,
  addingItemParentId,
  onCancelAddingItem,
  onCreateItem,
  initiallyCollapsedItemIds,
}: {
  item: TaskChecklistItem
  githubLinks: GithubLink[]
  subtasks: Task[]
  siblings: TaskChecklistItem[]
  index: number
  parentItem: TaskChecklistItem | undefined
  depth: number
  onUpdateItem: (itemId: string, input: UpdateTaskChecklistItemInput) => void
  onDeleteItem: (itemId: string) => void
  onMoveItem: (itemId: string, input: MoveTaskChecklistItemInput) => void
  onSetItemChecked: (itemId: string, checked: boolean) => void
  onLinkGithub: (itemId: string, url: string) => void
  onPromoteItem: (itemId: string) => void
  onStartAddingItem: (parentItemId: string) => void
  addingItemParentId: string | null | undefined
  onCancelAddingItem: () => void
  onCreateItem: (content: string, parentItemId: string | null) => void
  initiallyCollapsedItemIds: string[]
}) {
  const [collapsed, setCollapsed] = useState(
    initiallyCollapsedItemIds.includes(item.id),
  )
  const [editingContent, setEditingContent] = useState(false)
  const [contentDraft, setContentDraft] = useState(item.content)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [editingNote, setEditingNote] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const { onChange: onNoteChange, flush: flushNoteChange } = useDebouncedSave(
    (note) => {
      onUpdateItem(item.id, { note })
    },
  )

  useEffect(() => {
    if (!editingContent) setContentDraft(item.content)
  }, [editingContent, item.content])

  const hasChildren = item.children.length > 0
  const githubLink = githubLinks.find((link) => link.id === item.githubLinkId)
  const subtask = subtasks.find((task) => task.id === item.subtaskId)
  const isLocked =
    hasChildren || item.githubLinkId != null || item.subtaskId != null
  const previousSibling = index > 0 ? siblings[index - 1] : undefined
  const nextSibling = siblings[index + 1]
  const previousBeforeItem = index > 1 ? siblings[index - 2] : undefined
  const indentMove =
    previousSibling == null ||
    previousSibling.githubLinkId != null ||
    previousSibling.subtaskId != null
      ? undefined
      : { parentItemId: previousSibling.id }
  const outdentMove =
    parentItem == null
      ? undefined
      : {
          parentItemId: parentItem.parentItemId,
          afterItemId: parentItem.id,
        }
  const counts = countChecklistLeaves([item])
  const canLinkOrPromote =
    !hasChildren && item.githubLinkId == null && item.subtaskId == null

  const itemActions = [
    {
      icon: <Pencil className="size-4" />,
      label: 'edit',
      onClick: () => {
        setEditingContent(true)
      },
    },
    ...(item.githubLinkId == null && item.subtaskId == null
      ? [
          {
            icon: <Plus className="size-4" />,
            label: 'add subitem',
            onClick: () => {
              setCollapsed(false)
              onStartAddingItem(item.id)
            },
          },
        ]
      : []),
    ...(canLinkOrPromote
      ? [
          {
            icon: <GitPullRequest className="size-4" />,
            label: 'link pull request',
            onClick: () => {
              setLinkDialogOpen(true)
            },
          },
          {
            icon: <ArrowUpRight className="size-4" />,
            label: 'promote to subtask',
            onClick: () => {
              onPromoteItem(item.id)
            },
          },
        ]
      : []),
    {
      icon: <Pencil className="size-4" />,
      label:
        item.note == null || item.note === '' ? 'add details' : 'edit details',
      onClick: () => {
        setDetailsOpen(true)
        setEditingNote(true)
      },
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
      onClick: () => {
        setDeleteDialogOpen(true)
      },
      destructive: true,
    },
  ]

  const saveContent = () => {
    const content = contentDraft.trim()
    if (content.length > 0 && content !== item.content) {
      onUpdateItem(item.id, { content })
    }
    setEditingContent(false)
  }

  const handleContentKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return

    if (event.key === 'Enter') {
      event.currentTarget.blur()
      return
    }
    if (event.key === 'Escape') {
      setContentDraft(item.content)
      setEditingContent(false)
      return
    }
    if (event.key !== 'Tab') return

    const move = event.shiftKey ? outdentMove : indentMove

    if (move == null) return
    event.preventDefault()
    saveContent()
    onMoveItem(item.id, move)
  }

  return (
    <div className="group">
      <div
        className="flex min-h-10 items-center gap-2 px-3 py-1"
        style={{ paddingLeft: `${String(12 + depth * 20)}px` }}
      >
        {hasChildren ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={
              collapsed ? `Expand ${item.content}` : `Collapse ${item.content}`
            }
            onClick={() => {
              setCollapsed((value) => !value)
            }}
            className="size-5 shrink-0 rounded-none p-0"
          >
            <ChevronDown
              className={`size-3.5 transition-transform ${collapsed ? '-rotate-90' : ''}`}
            />
          </Button>
        ) : (
          <span className="size-5 shrink-0" aria-hidden="true" />
        )}
        <Checkbox
          aria-label={`${item.checkedAt == null ? 'Check' : 'Uncheck'} ${item.content}`}
          checked={item.checkedAt != null}
          disabled={isLocked}
          onCheckedChange={(checked) => {
            onSetItemChecked(item.id, checked)
          }}
          className={isLocked ? 'border-dashed' : undefined}
        />
        <div className="min-w-0 flex-1">
          {editingContent ? (
            <Input
              aria-label={`Edit ${item.content}`}
              autoFocus
              value={contentDraft}
              onChange={(event) => {
                setContentDraft(event.currentTarget.value)
              }}
              onBlur={saveContent}
              onKeyDown={handleContentKeyDown}
              className="h-7 min-w-0 border-0 px-1 py-0 font-mono text-xs shadow-none focus-visible:ring-1"
            />
          ) : (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setEditingContent(true)
              }}
              className={`h-auto min-h-0 justify-start overflow-hidden rounded-none border-0 bg-transparent p-0 text-left font-mono text-xs font-normal shadow-none transition-none hover:bg-transparent active:translate-y-0 ${item.checkedAt == null ? 'text-foreground' : 'text-muted-foreground line-through'}`}
            >
              <span className={hasChildren ? 'font-semibold' : undefined}>
                {item.content}
              </span>
            </Button>
          )}
          {(githubLink != null || subtask != null) && (
            <div className="mt-1 flex min-w-0 flex-wrap gap-1">
              {githubLink != null && <GithubLinkBadge link={githubLink} />}
              {subtask != null && (
                <Link
                  to="/tasks/$taskId"
                  params={{ taskId: subtask.id }}
                  aria-label={`#${String(subtask.number)} ${subtask.title}`}
                  className="inline-flex max-w-full min-w-0 items-center gap-1 border border-border px-1 font-mono text-2xs text-muted-foreground hover:text-foreground"
                >
                  <span className="shrink-0 font-bold text-primary">
                    #{subtask.number}
                  </span>
                  <span className="truncate">{subtask.title}</span>
                </Link>
              )}
            </div>
          )}
        </div>
        {hasChildren && (
          <span className="shrink-0 font-mono text-2xs text-muted-foreground-faint">
            {counts.completed}/{counts.total}
          </span>
        )}
        <ActionsMenu
          aria-label={`Actions for ${item.content}`}
          items={itemActions}
          mobileTriggerClassName="-mr-2 size-9"
        />
      </div>

      <div style={{ paddingLeft: `${String(36 + depth * 20)}px` }}>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            if (detailsOpen) {
              flushNoteChange()
              setDetailsOpen(false)
              setEditingNote(false)
            } else {
              setDetailsOpen(true)
              if (item.note == null || item.note === '') setEditingNote(true)
            }
          }}
          className="h-5 min-h-0 justify-start gap-1 rounded-none border-0 bg-transparent p-0 text-2xs font-normal text-muted-foreground-faint shadow-none hover:bg-transparent hover:text-muted-foreground active:translate-y-0"
        >
          <ChevronDown
            className={`size-3 transition-transform ${detailsOpen ? '' : '-rotate-90'}`}
          />
          {item.note == null || item.note === '' ? 'add details' : 'details'}
        </Button>
      </div>

      {!collapsed && (
        <TaskChecklistItemTree
          items={item.children}
          parentItem={item}
          depth={depth + 1}
          addingItemParentId={addingItemParentId}
          onCancelAddingItem={onCancelAddingItem}
          onCreateItem={onCreateItem}
          onUpdateItem={onUpdateItem}
          onDeleteItem={onDeleteItem}
          onMoveItem={onMoveItem}
          onSetItemChecked={onSetItemChecked}
          githubLinks={githubLinks}
          subtasks={subtasks}
          onLinkGithub={onLinkGithub}
          onPromoteItem={onPromoteItem}
          onStartAddingItem={onStartAddingItem}
          initiallyCollapsedItemIds={initiallyCollapsedItemIds}
        />
      )}

      {detailsOpen && (
        <div
          className="border-l border-border py-2 pr-3"
          style={{
            marginLeft: `${String(46 + depth * 20)}px`,
            paddingLeft: '10px',
          }}
        >
          <MarkdownEditor
            defaultValue={item.note ?? ''}
            editing={editingNote}
            onEditingChange={setEditingNote}
            onChange={onNoteChange}
            onExitEditMode={flushNoteChange}
            placeholder="Add details..."
            size="compact"
          />
        </div>
      )}

      <DeleteConfirmDialog
        title="Delete checklist item"
        description={`Are you sure you want to delete "${item.content}" and its nested items? This action cannot be undone.`}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => {
          onDeleteItem(item.id)
        }}
      />
      <ChecklistItemGithubLinkDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        itemContent={item.content}
        onSubmit={(url) => {
          onLinkGithub(item.id, url)
        }}
      />
    </div>
  )
}
