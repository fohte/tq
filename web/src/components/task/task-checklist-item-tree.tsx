import { Button } from '@fohte/ui/button'
import { ChevronDown } from 'lucide-react'
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  type ChecklistIndentStyle,
  getChecklistIndentStyle,
} from '#components/task/checklist-indent-style'
import { ChecklistItemContentInput } from '#components/task/checklist-item-content-input'
import { ChecklistItemGithubLinkDialog } from '#components/task/checklist-item-github-link-dialog'
import { createChecklistItemActions } from '#components/task/task-checklist-item-actions'
import { ChecklistItemComposer } from '#components/task/task-checklist-item-composer'
import { TaskChecklistItemLinkedTargets } from '#components/task/task-checklist-item-linked-targets'
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
import { renderChecklistItemMarkdown } from '#lib/checklist-item-markdown'
import { countChecklistLeaves } from '#lib/task-checklist-tree'

interface TaskChecklistItemTreeProps {
  items: TaskChecklistItem[]
  githubLinks: GithubLink[]
  subtasks: Task[]
  linkGithubErrorMessage: string | undefined
  isLinkingGithub: boolean
  parentItem?: TaskChecklistItem | undefined
  depth?: number
  addingItemParentId: string | null | undefined
  onCancelAddingItem: () => void
  onCreateItem: (content: string, parentItemId: string | null) => void
  onUpdateItem: (itemId: string, input: UpdateTaskChecklistItemInput) => void
  onDeleteItem: (itemId: string) => void
  onMoveItem: (itemId: string, input: MoveTaskChecklistItemInput) => void
  onSetItemChecked: (itemId: string, checked: boolean) => void
  onLinkGithub: (itemId: string, url: string, onSuccess: () => void) => void
  onPromoteItem: (itemId: string) => void
  onStartAddingItem: (parentItemId: string) => void
  initiallyCollapsedItemIds?: string[] | undefined
  initiallyOpenDetailsItemIds?: string[] | undefined
}

export function TaskChecklistItemTree({
  items,
  githubLinks,
  subtasks,
  linkGithubErrorMessage,
  isLinkingGithub,
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
  initiallyOpenDetailsItemIds = [],
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
          linkGithubErrorMessage={linkGithubErrorMessage}
          isLinkingGithub={isLinkingGithub}
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
          initiallyOpenDetailsItemIds={initiallyOpenDetailsItemIds}
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
  linkGithubErrorMessage,
  isLinkingGithub,
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
  initiallyOpenDetailsItemIds,
}: {
  item: TaskChecklistItem
  githubLinks: GithubLink[]
  subtasks: Task[]
  linkGithubErrorMessage: string | undefined
  isLinkingGithub: boolean
  siblings: TaskChecklistItem[]
  index: number
  parentItem: TaskChecklistItem | undefined
  depth: number
  onUpdateItem: (itemId: string, input: UpdateTaskChecklistItemInput) => void
  onDeleteItem: (itemId: string) => void
  onMoveItem: (itemId: string, input: MoveTaskChecklistItemInput) => void
  onSetItemChecked: (itemId: string, checked: boolean) => void
  onLinkGithub: (itemId: string, url: string, onSuccess: () => void) => void
  onPromoteItem: (itemId: string) => void
  onStartAddingItem: (parentItemId: string) => void
  addingItemParentId: string | null | undefined
  onCancelAddingItem: () => void
  onCreateItem: (content: string, parentItemId: string | null) => void
  initiallyCollapsedItemIds: string[]
  initiallyOpenDetailsItemIds: string[]
}) {
  const [collapsed, setCollapsed] = useState(
    initiallyCollapsedItemIds.includes(item.id),
  )
  const [editingContent, setEditingContent] = useState(false)
  const [contentDraft, setContentDraft] = useState(item.content)
  const [detailsOpen, setDetailsOpen] = useState(
    initiallyOpenDetailsItemIds.includes(item.id),
  )
  const [editingNote, setEditingNote] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const startEditingContent = useCallback(() => {
    setEditingContent(true)
  }, [])
  const { onChange: onNoteChange, flush: flushNoteChange } = useDebouncedSave(
    (note) => {
      onUpdateItem(item.id, { note })
    },
  )

  useEffect(() => {
    if (!editingContent) setContentDraft(item.content)
  }, [editingContent, item.content])

  const hasChildren = item.children.length > 0
  const checklistItemMarkdown = useMemo(
    () =>
      renderChecklistItemMarkdown({
        content: item.content,
        checked: item.checkedAt != null,
        bold: hasChildren,
        onEdit: startEditingContent,
      }),
    [item.content, item.checkedAt, hasChildren, startEditingContent],
  )
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
  const canLinkOrPromote = !isLocked

  const itemActions = createChecklistItemActions({
    item,
    index,
    nextSibling,
    previousBeforeItem,
    indentMove,
    outdentMove,
    canLinkOrPromote,
    onEdit: () => {
      setEditingContent(true)
    },
    onAddSubitem: () => {
      setCollapsed(false)
      onStartAddingItem(item.id)
    },
    onLinkGithub: () => {
      setLinkDialogOpen(true)
    },
    onPromote: () => {
      onPromoteItem(item.id)
    },
    onEditDetails: () => {
      setDetailsOpen(true)
      setEditingNote(true)
    },
    onMoveItem,
    onDelete: () => {
      setDeleteDialogOpen(true)
    },
  })

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

  const itemIndentStyle = getChecklistIndentStyle(12 + depth * 20)
  const detailsIndentStyle = getChecklistIndentStyle(36 + depth * 20)
  const noteIndentStyle = getChecklistIndentStyle(46 + depth * 20)

  return (
    <div className="group">
      <div
        className="flex min-h-10 items-center gap-2 py-1 pl-(--checklist-indent) pr-3"
        style={
          {
            '--checklist-indent': itemIndentStyle['--checklist-indent'],
          } as ChecklistIndentStyle
        }
      >
        {hasChildren ? (
          <Button
            type="button"
            variant="plain"
            aria-label={
              collapsed ? `Expand ${item.content}` : `Collapse ${item.content}`
            }
            onClick={() => {
              setCollapsed((value) => !value)
            }}
            className="size-5 shrink-0"
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
        />
        <div className="min-w-0 flex-1">
          {editingContent ? (
            <ChecklistItemContentInput
              itemContent={item.content}
              value={contentDraft}
              onChange={(event) => {
                setContentDraft(event.currentTarget.value)
              }}
              onBlur={saveContent}
              onKeyDown={handleContentKeyDown}
            />
          ) : (
            checklistItemMarkdown
          )}
          <TaskChecklistItemLinkedTargets
            githubLink={githubLink}
            subtask={subtask}
          />
        </div>
        {hasChildren && (
          <span className="shrink-0 font-mono text-2xs text-muted-foreground-faint">
            {counts.completed}/{counts.total}
          </span>
        )}
        <ActionsMenu
          aria-label={`Actions for ${item.content}`}
          items={itemActions}
          mobileTriggerLayout="tree-row"
        />
      </div>

      <div
        className="pl-(--checklist-indent)"
        style={
          {
            '--checklist-indent': detailsIndentStyle['--checklist-indent'],
          } as ChecklistIndentStyle
        }
      >
        <Button
          type="button"
          variant="plain"
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
          className="h-5 min-h-0 justify-start"
        >
          <span className="inline-flex items-center gap-1">
            <ChevronDown
              className={`size-3 transition-transform ${detailsOpen ? '' : '-rotate-90'}`}
            />
            <span className="text-2xs">
              {item.note == null || item.note === ''
                ? 'add details'
                : 'details'}
            </span>
          </span>
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
          linkGithubErrorMessage={linkGithubErrorMessage}
          isLinkingGithub={isLinkingGithub}
          onLinkGithub={onLinkGithub}
          onPromoteItem={onPromoteItem}
          onStartAddingItem={onStartAddingItem}
          initiallyCollapsedItemIds={initiallyCollapsedItemIds}
          initiallyOpenDetailsItemIds={initiallyOpenDetailsItemIds}
        />
      )}

      {detailsOpen && (
        <div
          className="ml-(--checklist-indent) border-l border-border py-2 pr-3 pl-2.5"
          style={
            {
              '--checklist-indent': noteIndentStyle['--checklist-indent'],
            } as ChecklistIndentStyle
          }
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
        errorMessage={linkGithubErrorMessage}
        isPending={isLinkingGithub}
        onSubmit={(url, onSuccess) => {
          onLinkGithub(item.id, url, onSuccess)
        }}
      />
    </div>
  )
}
