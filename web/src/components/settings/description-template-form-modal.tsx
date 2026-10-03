import { Button } from '@fohte/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@fohte/ui/dialog'
import { Input } from '@fohte/ui/input'
import { useState } from 'react'

import { Checkbox } from '#components/ui/checkbox'
import { MarkdownEditor } from '#components/ui/markdown-editor'
import type { DescriptionTemplate } from '#hooks/use-description-templates'
import {
  useCreateDescriptionTemplate,
  useUpdateDescriptionTemplate,
} from '#hooks/use-description-templates'

export interface DescriptionTemplateFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  template?: DescriptionTemplate
}

export function DescriptionTemplateFormModal({
  open,
  onOpenChange,
  template,
}: DescriptionTemplateFormModalProps) {
  const [name, setName] = useState(template?.name ?? '')
  const [whenToUse, setWhenToUse] = useState(template?.whenToUse ?? '')
  const [body, setBody] = useState(template?.body ?? '')
  const [guide, setGuide] = useState(template?.guide ?? '')
  const [isDefault, setIsDefault] = useState(template?.isDefault ?? false)

  const createTemplate = useCreateDescriptionTemplate()
  const updateTemplate = useUpdateDescriptionTemplate()
  const isPending = createTemplate.isPending || updateTemplate.isPending

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen)
  }

  const handleSubmit = () => {
    const input = {
      name: name.trim(),
      whenToUse,
      body,
      guide,
      isDefault,
    }
    if (input.name === '' || isPending) return

    if (template != null) {
      updateTemplate.mutate(
        { name: template.name, input },
        {
          onSuccess: () => {
            handleOpenChange(false)
          },
        },
      )
      return
    }

    createTemplate.mutate(input, {
      onSuccess: () => {
        handleOpenChange(false)
      },
    })
  }

  const saveFailed = createTemplate.isError || updateTemplate.isError

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {template == null ? 'テンプレートを追加' : 'テンプレートを編集'}
          </DialogTitle>
          <DialogDescription>
            新規作成時に description へ挿入する内容を設定します。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <FieldRow label="名前" htmlFor="description-template-name">
            <Input
              id="description-template-name"
              type="text"
              value={name}
              onChange={(event) => {
                setName(event.target.value)
              }}
              placeholder="Template name"
              className="h-auto w-full rounded-md border border-border bg-transparent dark:bg-transparent px-2 py-1 text-sm outline-none focus:border-primary/50 focus-visible:border-primary/50 focus-visible:ring-0"
            />
          </FieldRow>

          <FieldRow label="使う場面" htmlFor="description-template-when-to-use">
            <Input
              id="description-template-when-to-use"
              type="text"
              value={whenToUse}
              onChange={(event) => {
                setWhenToUse(event.target.value)
              }}
              className="h-auto w-full rounded-md border border-border bg-transparent dark:bg-transparent px-2 py-1 text-sm outline-none focus:border-primary/50 focus-visible:border-primary/50 focus-visible:ring-0"
            />
          </FieldRow>

          <FieldRow label="本文" align="start">
            <div className="min-w-0 flex-1 rounded-lg border border-border p-1 text-sm">
              <MarkdownEditor
                defaultValue={body}
                onChange={setBody}
                placeholder="本文を入力してください"
                size="compact"
              />
            </div>
          </FieldRow>

          <FieldRow label="書き方" align="start">
            <div className="min-w-0 flex-1 rounded-lg border border-border p-1 text-sm">
              <MarkdownEditor
                defaultValue={guide}
                onChange={setGuide}
                placeholder="各節の書き方を入力してください"
                size="compact"
              />
            </div>
          </FieldRow>

          <label className="flex items-center gap-2 text-sm text-foreground">
            <Checkbox
              checked={isDefault}
              onCheckedChange={(checked) => {
                setIsDefault(checked)
              }}
              className="rounded border-border bg-white dark:bg-white"
            />
            新規作成時の既定にする
          </label>

          {saveFailed && (
            <p role="alert" className="text-sm text-destructive">
              テンプレートの保存に失敗しました
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              handleOpenChange(false)
            }}
          >
            キャンセル
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={name.trim() === '' || isPending}
          >
            {template == null ? '作成' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function FieldRow({
  label,
  htmlFor,
  align = 'center',
  children,
}: {
  label: string
  htmlFor?: string | undefined
  align?: 'center' | 'start'
  children: React.ReactNode
}) {
  return (
    <div
      className={`flex gap-3 ${align === 'start' ? 'items-start' : 'items-center'}`}
    >
      {htmlFor == null ? (
        <span
          className={`w-28 shrink-0 text-xs font-medium text-muted-foreground ${align === 'start' ? 'pt-2' : ''}`}
        >
          {label}
        </span>
      ) : (
        <label
          htmlFor={htmlFor}
          className="w-28 shrink-0 text-xs font-medium text-muted-foreground"
        >
          {label}
        </label>
      )}
      {children}
    </div>
  )
}
