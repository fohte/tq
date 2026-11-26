import { Button } from '@fohte/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@fohte/ui/dialog'
import { Input } from '@fohte/ui/input'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { type SyntheticEvent, useState } from 'react'

import { DeleteConfirmDialog } from '#components/ui/delete-confirm-dialog'
import type { ProjectField } from '#hooks/use-project-fields'

type DeleteTarget =
  | { kind: 'field'; fieldId: string; name: string }
  | { kind: 'option'; fieldId: string; optionId: string; name: string }

export interface ProjectFieldsManagerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fields: ProjectField[]
  isLoading?: boolean
  loadError?: boolean
  initialEditingFieldId?: string
  initialEditingOption?: { fieldId: string; optionId: string }
  initialDeleteTarget?: DeleteTarget
  initialErrorMessage?: string
  onCreateField: (name: string) => Promise<void>
  onRenameField: (fieldId: string, name: string) => Promise<void>
  onDeleteField: (fieldId: string) => Promise<void>
  onCreateOption: (fieldId: string, name: string) => Promise<void>
  onRenameOption: (
    fieldId: string,
    optionId: string,
    name: string,
  ) => Promise<void>
  onDeleteOption: (fieldId: string, optionId: string) => Promise<void>
}

export function ProjectFieldsManagerDialog({
  open,
  onOpenChange,
  fields,
  isLoading = false,
  loadError = false,
  initialEditingFieldId,
  initialEditingOption,
  initialDeleteTarget,
  initialErrorMessage,
  onCreateField,
  onRenameField,
  onDeleteField,
  onCreateOption,
  onRenameOption,
  onDeleteOption,
}: ProjectFieldsManagerDialogProps) {
  const [newFieldName, setNewFieldName] = useState('')
  const [newOptionNames, setNewOptionNames] = useState<Record<string, string>>(
    {},
  )
  const [editingField, setEditingField] = useState<{
    id: string
    name: string
  } | null>(() => {
    const field = fields.find(({ id }) => id === initialEditingFieldId)
    return field == null ? null : { id: field.id, name: field.name }
  })
  const [editingOption, setEditingOption] = useState<{
    fieldId: string
    optionId: string
    name: string
  } | null>(() => {
    const field = fields.find(({ id }) => id === initialEditingOption?.fieldId)
    const option = field?.options.find(
      ({ id }) => id === initialEditingOption?.optionId,
    )
    return field == null || option == null
      ? null
      : { fieldId: field.id, optionId: option.id, name: option.name }
  })
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(
    initialDeleteTarget ?? null,
  )
  const [errorMessage, setErrorMessage] = useState(initialErrorMessage ?? '')
  const [pendingAction, setPendingAction] = useState(false)

  const runAction = async (action: () => Promise<void>) => {
    if (pendingAction) return
    setPendingAction(true)
    setErrorMessage('')
    await action()
      .catch((error: unknown) => {
        setErrorMessage(
          error instanceof Error ? error.message : '保存に失敗しました',
        )
      })
      .finally(() => {
        setPendingAction(false)
      })
  }

  const handleCreateField = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = newFieldName.trim()
    if (name === '') return
    void runAction(async () => {
      await onCreateField(name)
      setNewFieldName('')
    })
  }

  const handleCreateOption = (
    event: SyntheticEvent<HTMLFormElement>,
    fieldId: string,
  ) => {
    event.preventDefault()
    const name = (newOptionNames[fieldId] ?? '').trim()
    if (name === '') return
    void runAction(async () => {
      await onCreateOption(fieldId, name)
      setNewOptionNames((current) => ({ ...current, [fieldId]: '' }))
    })
  }

  const handleDelete = () => {
    if (deleteTarget == null) return
    const target = deleteTarget
    void runAction(async () => {
      if (target.kind === 'field') {
        await onDeleteField(target.fieldId)
      } else {
        await onDeleteOption(target.fieldId, target.optionId)
      }
      setDeleteTarget(null)
    })
  }

  const deleteDescription =
    deleteTarget?.kind === 'field'
      ? `「${deleteTarget.name}」を削除すると、このフィールドに設定されているすべてのタスクの値も削除されます。この操作は取り消せません。`
      : deleteTarget?.kind === 'option'
        ? `「${deleteTarget.name}」を削除すると、この選択肢を設定しているタスクは未設定になります。この操作は取り消せません。`
        : ''

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-dvh max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>プロジェクトのフィールド</DialogTitle>
            <DialogDescription>
              フィールドと選択肢を管理します。変更は操作ごとに保存されます。
            </DialogDescription>
          </DialogHeader>

          <form className="flex gap-2" onSubmit={handleCreateField}>
            <Input
              aria-label="新しいフィールド名"
              placeholder="フィールド名"
              value={newFieldName}
              onChange={(event) => {
                setNewFieldName(event.target.value)
              }}
              disabled={pendingAction}
            />
            <Button
              type="submit"
              disabled={!newFieldName.trim() || pendingAction}
            >
              <Plus className="size-4" />
              追加
            </Button>
          </form>

          {errorMessage !== '' && (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage}
            </p>
          )}
          {loadError && (
            <p role="alert" className="text-sm text-destructive">
              フィールドの取得に失敗しました
            </p>
          )}

          {isLoading ? (
            <p className="text-sm text-muted-foreground">読み込み中です</p>
          ) : loadError ? null : fields.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              フィールドはまだありません
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {fields.map((field) => (
                <section
                  key={field.id}
                  aria-label={field.name}
                  className="flex flex-col gap-3 rounded-md border border-border p-3"
                >
                  <div className="flex items-center gap-2">
                    {editingField?.id === field.id ? (
                      <>
                        <Input
                          aria-label="フィールド名を変更"
                          value={editingField.name}
                          onChange={(event) => {
                            setEditingField({
                              id: field.id,
                              name: event.target.value,
                            })
                          }}
                          disabled={pendingAction}
                        />
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          aria-label="フィールド名を保存"
                          disabled={!editingField.name.trim() || pendingAction}
                          onClick={() => {
                            void runAction(async () => {
                              await onRenameField(
                                field.id,
                                editingField.name.trim(),
                              )
                              setEditingField(null)
                            })
                          }}
                        >
                          <Check className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          aria-label="フィールド名の変更をキャンセル"
                          onClick={() => {
                            setEditingField(null)
                          }}
                        >
                          <X className="size-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <h3 className="min-w-0 flex-1 truncate text-sm font-medium">
                          {field.name}
                        </h3>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`${field.name}を編集`}
                          onClick={() => {
                            setEditingField({ id: field.id, name: field.name })
                          }}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`${field.name}を削除`}
                          onClick={() => {
                            setDeleteTarget({
                              kind: 'field',
                              fieldId: field.id,
                              name: field.name,
                            })
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 pl-3">
                    {field.options.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        選択肢はまだありません
                      </p>
                    ) : (
                      field.options.map((option) => (
                        <div
                          key={option.id}
                          className="flex items-center gap-2"
                        >
                          {editingOption?.fieldId === field.id &&
                          editingOption.optionId === option.id ? (
                            <>
                              <Input
                                aria-label="選択肢名を変更"
                                value={editingOption.name}
                                onChange={(event) => {
                                  setEditingOption({
                                    ...editingOption,
                                    name: event.target.value,
                                  })
                                }}
                                disabled={pendingAction}
                              />
                              <Button
                                type="button"
                                size="icon-sm"
                                variant="ghost"
                                aria-label="選択肢名を保存"
                                disabled={
                                  !editingOption.name.trim() || pendingAction
                                }
                                onClick={() => {
                                  void runAction(async () => {
                                    await onRenameOption(
                                      field.id,
                                      option.id,
                                      editingOption.name.trim(),
                                    )
                                    setEditingOption(null)
                                  })
                                }}
                              >
                                <Check className="size-4" />
                              </Button>
                              <Button
                                type="button"
                                size="icon-sm"
                                variant="ghost"
                                aria-label="選択肢名の変更をキャンセル"
                                onClick={() => {
                                  setEditingOption(null)
                                }}
                              >
                                <X className="size-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <span className="min-w-0 flex-1 truncate text-sm">
                                {option.name}
                              </span>
                              <Button
                                type="button"
                                size="icon-sm"
                                variant="ghost"
                                aria-label={`${option.name}を編集`}
                                onClick={() => {
                                  setEditingOption({
                                    fieldId: field.id,
                                    optionId: option.id,
                                    name: option.name,
                                  })
                                }}
                              >
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                type="button"
                                size="icon-sm"
                                variant="ghost"
                                aria-label={`${option.name}を削除`}
                                onClick={() => {
                                  setDeleteTarget({
                                    kind: 'option',
                                    fieldId: field.id,
                                    optionId: option.id,
                                    name: option.name,
                                  })
                                }}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      ))
                    )}

                    <form
                      className="flex gap-2"
                      onSubmit={(event) => {
                        handleCreateOption(event, field.id)
                      }}
                    >
                      <Input
                        aria-label={`${field.name}の新しい選択肢`}
                        placeholder="選択肢を追加"
                        value={newOptionNames[field.id] ?? ''}
                        onChange={(event) => {
                          setNewOptionNames((current) => ({
                            ...current,
                            [field.id]: event.target.value,
                          }))
                        }}
                        disabled={pendingAction}
                      />
                      <Button
                        type="submit"
                        variant="outline"
                        disabled={
                          !(newOptionNames[field.id] ?? '').trim() ||
                          pendingAction
                        }
                      >
                        <Plus className="size-4" />
                        追加
                      </Button>
                    </form>
                  </div>
                </section>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setDeleteTarget(null)
        }}
        title={
          deleteTarget?.kind === 'field'
            ? 'フィールドを削除しますか?'
            : '選択肢を削除しますか?'
        }
        description={deleteDescription}
        confirmLabel="削除"
        onConfirm={handleDelete}
      />
    </>
  )
}
