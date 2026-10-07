import { Button } from '@fohte/ui/button'
import { Input } from '@fohte/ui/input'
import { Panel } from '@fohte/ui/panel'
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { TaskChecklistItemTree } from '#components/task/task-checklist-item-tree'
import { ActionsMenu } from '#components/ui/actions-menu'
import { DeleteConfirmDialog } from '#components/ui/delete-confirm-dialog'
import { SectionHeading } from '#components/ui/section-heading'
import type { GithubLink } from '#hooks/use-github-link'
import type {
  CreateTaskChecklistItemInput,
  MoveTaskChecklistItemInput,
  TaskChecklist,
  UpdateTaskChecklistItemInput,
} from '#hooks/use-task-checklists'
import type { Task } from '#hooks/use-tasks'
import { countChecklistLeaves } from '#lib/task-checklist-tree'

interface TaskChecklistListProps {
  checklists: TaskChecklist[]
  githubLinks: GithubLink[]
  subtasks: Task[]
  linkGithubErrorMessage: string | undefined
  isLinkingGithub: boolean
  onCreateChecklist: () => void
  onUpdateChecklist: (
    checklistId: string,
    input: { name?: string | null },
  ) => void
  onReorderChecklists: (checklistIds: string[]) => void
  onDeleteChecklist: (checklistId: string) => void
  onCreateItem: (
    checklistId: string,
    input: CreateTaskChecklistItemInput,
  ) => void
  onUpdateItem: (itemId: string, input: UpdateTaskChecklistItemInput) => void
  onDeleteItem: (itemId: string) => void
  onMoveItem: (itemId: string, input: MoveTaskChecklistItemInput) => void
  onSetItemChecked: (itemId: string, checked: boolean) => void
  onLinkGithub: (itemId: string, url: string, onSuccess: () => void) => void
  onPromoteItem: (itemId: string) => void
}

export function TaskChecklistList({
  checklists,
  githubLinks,
  subtasks,
  linkGithubErrorMessage,
  isLinkingGithub,
  onCreateChecklist,
  onUpdateChecklist,
  onReorderChecklists,
  onDeleteChecklist,
  onCreateItem,
  onUpdateItem,
  onDeleteItem,
  onMoveItem,
  onSetItemChecked,
  onLinkGithub,
  onPromoteItem,
}: TaskChecklistListProps) {
  const counts = countChecklistLeaves(
    checklists.flatMap((checklist) => checklist.items),
  )

  const moveChecklist = (fromIndex: number, toIndex: number) => {
    const reordered = [...checklists]
    const [moved] = reordered.splice(fromIndex, 1)
    if (moved == null) return
    reordered.splice(toIndex, 0, moved)
    onReorderChecklists(reordered.map((checklist) => checklist.id))
  }

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-baseline gap-2">
        <SectionHeading level={3}>checklists</SectionHeading>
        <span className="font-mono text-2xs text-muted-foreground-faint">
          {counts.completed}/{counts.total}
        </span>
      </div>

      {checklists.length > 0 && (
        <div className="flex flex-col gap-2">
          {checklists.map((checklist, index) => (
            <ChecklistPanel
              key={checklist.id}
              checklist={checklist}
              githubLinks={githubLinks}
              subtasks={subtasks}
              linkGithubErrorMessage={linkGithubErrorMessage}
              isLinkingGithub={isLinkingGithub}
              checklistIndex={index}
              checklistCount={checklists.length}
              onCreateItem={onCreateItem}
              onUpdateItem={onUpdateItem}
              onDeleteChecklist={onDeleteChecklist}
              onUpdateChecklist={onUpdateChecklist}
              onMoveChecklist={moveChecklist}
              onDeleteItem={onDeleteItem}
              onMoveItem={onMoveItem}
              onSetItemChecked={onSetItemChecked}
              onLinkGithub={onLinkGithub}
              onPromoteItem={onPromoteItem}
            />
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="ghost"
        onClick={onCreateChecklist}
        className="h-auto min-h-0 w-fit justify-start rounded-none border-0 bg-transparent px-0 py-0 font-mono text-xs font-normal text-muted-foreground-faint shadow-none transition-colors hover:bg-transparent hover:text-muted-foreground active:translate-y-0"
      >
        <Plus className="size-3" />
        add checklist
      </Button>
    </section>
  )
}

function ChecklistPanel({
  checklist,
  githubLinks,
  subtasks,
  linkGithubErrorMessage,
  isLinkingGithub,
  checklistIndex,
  checklistCount,
  onCreateItem,
  onUpdateItem,
  onDeleteChecklist,
  onUpdateChecklist,
  onMoveChecklist,
  onDeleteItem,
  onMoveItem,
  onSetItemChecked,
  onLinkGithub,
  onPromoteItem,
}: {
  checklist: TaskChecklist
  githubLinks: GithubLink[]
  subtasks: Task[]
  linkGithubErrorMessage: string | undefined
  isLinkingGithub: boolean
  checklistIndex: number
  checklistCount: number
  onCreateItem: (
    checklistId: string,
    input: CreateTaskChecklistItemInput,
  ) => void
  onUpdateItem: (itemId: string, input: UpdateTaskChecklistItemInput) => void
  onDeleteChecklist: (checklistId: string) => void
  onUpdateChecklist: (
    checklistId: string,
    input: { name?: string | null },
  ) => void
  onMoveChecklist: (fromIndex: number, toIndex: number) => void
  onDeleteItem: (itemId: string) => void
  onMoveItem: (itemId: string, input: MoveTaskChecklistItemInput) => void
  onSetItemChecked: (itemId: string, checked: boolean) => void
  onLinkGithub: (itemId: string, url: string, onSuccess: () => void) => void
  onPromoteItem: (itemId: string) => void
}) {
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(checklist.name ?? '')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [addingItemParentId, setAddingItemParentId] = useState<
    string | null | undefined
  >()
  const counts = countChecklistLeaves(checklist.items)

  const saveName = () => {
    const name = nameDraft.trim() || null
    if (name !== checklist.name) onUpdateChecklist(checklist.id, { name })
    setEditingName(false)
  }

  const checklistActions = [
    {
      icon: <Pencil className="size-4" />,
      label: 'rename',
      onClick: () => {
        setNameDraft(checklist.name ?? '')
        setEditingName(true)
      },
    },
    ...(checklistIndex > 0
      ? [
          {
            icon: <ArrowUp className="size-4" />,
            label: 'move up',
            onClick: () => {
              onMoveChecklist(checklistIndex, checklistIndex - 1)
            },
          },
        ]
      : []),
    ...(checklistIndex < checklistCount - 1
      ? [
          {
            icon: <ArrowDown className="size-4" />,
            label: 'move down',
            onClick: () => {
              onMoveChecklist(checklistIndex, checklistIndex + 1)
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

  const saveItem = (content: string, parentItemId: string | null) => {
    onCreateItem(checklist.id, {
      content,
      ...(parentItemId == null ? {} : { parentItemId }),
    })
    setAddingItemParentId(undefined)
  }

  const showHeader = checklist.name != null || editingName

  return (
    <Panel padding="none" className="overflow-hidden">
      {showHeader && (
        <div className="flex min-h-9 items-center gap-2 border-b border-border bg-card px-3 py-1.5">
          {editingName ? (
            <Input
              aria-label="Checklist name"
              autoFocus
              value={nameDraft}
              onChange={(event) => {
                setNameDraft(event.currentTarget.value)
              }}
              onBlur={saveName}
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing) return

                if (event.key === 'Enter') event.currentTarget.blur()
                if (event.key === 'Escape') {
                  setNameDraft(checklist.name ?? '')
                  setEditingName(false)
                }
              }}
              className="h-6 min-w-0 max-w-sm px-1 font-mono text-xs"
            />
          ) : (
            <>
              <span className="font-mono text-xs font-medium text-foreground">
                {checklist.name}
              </span>
              <span className="font-mono text-2xs text-muted-foreground-faint">
                {counts.completed}/{counts.total}
              </span>
            </>
          )}
          <div className="ml-auto">
            <ActionsMenu
              aria-label="Checklist actions"
              items={checklistActions}
            />
          </div>
        </div>
      )}

      <div>
        <TaskChecklistItemTree
          items={checklist.items}
          githubLinks={githubLinks}
          subtasks={subtasks}
          linkGithubErrorMessage={linkGithubErrorMessage}
          isLinkingGithub={isLinkingGithub}
          addingItemParentId={addingItemParentId}
          onCancelAddingItem={() => {
            setAddingItemParentId(undefined)
          }}
          onCreateItem={saveItem}
          onUpdateItem={onUpdateItem}
          onDeleteItem={onDeleteItem}
          onMoveItem={onMoveItem}
          onSetItemChecked={onSetItemChecked}
          onLinkGithub={onLinkGithub}
          onPromoteItem={onPromoteItem}
          onStartAddingItem={(itemId) => {
            setAddingItemParentId(itemId)
          }}
        />
        <div className="flex min-h-11 items-center border-t border-dashed border-border">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setAddingItemParentId(null)
            }}
            className="h-auto min-h-0 flex-1 justify-start gap-1.5 rounded-none border-0 bg-transparent px-3 py-2 text-left font-mono text-xs font-normal text-muted-foreground-faint shadow-none transition-colors hover:bg-transparent hover:text-muted-foreground active:translate-y-0"
          >
            <Plus className="size-3" />
            add item
          </Button>
          {checklist.name == null && (
            <ActionsMenu
              aria-label="Checklist actions"
              items={checklistActions}
              mobileTriggerClassName="mr-1 h-9 w-9"
            />
          )}
        </div>
      </div>

      <DeleteConfirmDialog
        title="Delete checklist"
        description="Are you sure you want to delete this checklist and all its items? This action cannot be undone."
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => {
          onDeleteChecklist(checklist.id)
        }}
      />
    </Panel>
  )
}
