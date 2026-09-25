import { useState } from 'react'

import { Button } from '#components/ui/button'
import { Checkbox } from '#components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#components/ui/dialog'
import { Input } from '#components/ui/input'
import { SegmentedControl } from '#components/ui/segmented-control'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#components/ui/select'
import type { SyncRule } from '#hooks/use-github-sync-rules'
import {
  useCreateGithubSyncRule,
  useUpdateGithubSyncRule,
} from '#hooks/use-github-sync-rules'
import { useProjects } from '#hooks/use-projects'
import { selectValueHandler } from '#lib/form-utils'

export interface GithubSyncRuleFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Presence switches the modal into edit mode; scope/org/repo become read-only (PATCH doesn't accept them). */
  rule?: SyncRule
}

type Scope = SyncRule['scope']

const SCOPE_OPTIONS = [
  { value: 'all', label: 'すべて' },
  { value: 'org', label: 'Organization' },
  { value: 'repo', label: 'リポジトリ' },
] as const satisfies ReadonlyArray<{ value: Scope; label: string }>

const SCOPE_LABELS: Record<Scope, string> = {
  all: 'すべてのリポジトリ',
  org: 'Organization',
  repo: 'リポジトリ',
}

export function GithubSyncRuleFormModal({
  open,
  onOpenChange,
  rule,
}: GithubSyncRuleFormModalProps) {
  const [scope, setScope] = useState<Scope>(rule?.scope ?? 'all')
  const [org, setOrg] = useState(rule?.org ?? '')
  const [repo, setRepo] = useState(rule?.repo ?? '')
  const [targetProjectId, setTargetProjectId] = useState(
    rule?.targetProjectId ?? '',
  )
  const [includeExisting, setIncludeExisting] = useState(false)

  const projects = useProjects()
  const createRule = useCreateGithubSyncRule()
  const updateRule = useUpdateGithubSyncRule()

  const isPending = createRule.isPending || updateRule.isPending

  const resetForm = () => {
    setScope(rule?.scope ?? 'all')
    setOrg(rule?.org ?? '')
    setRepo(rule?.repo ?? '')
    setTargetProjectId(rule?.targetProjectId ?? '')
    setIncludeExisting(false)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    resetForm()
    onOpenChange(nextOpen)
  }

  const canSubmit =
    targetProjectId !== '' &&
    (rule != null ||
      scope === 'all' ||
      (scope === 'org' && org.trim() !== '') ||
      (scope === 'repo' && org.trim() !== '' && repo.trim() !== ''))

  const handleSubmit = () => {
    if (!canSubmit || isPending) return

    if (rule) {
      updateRule.mutate(
        { id: rule.id, input: { targetProjectId } },
        {
          onSuccess: () => {
            handleOpenChange(false)
          },
        },
      )
      return
    }

    createRule.mutate(
      {
        scope,
        ...(scope !== 'all' ? { org: org.trim() } : {}),
        ...(scope === 'repo' ? { repo: repo.trim() } : {}),
        targetProjectId,
        ...(includeExisting ? { includeExisting: true } : {}),
      },
      {
        onSuccess: () => {
          handleOpenChange(false)
        },
      },
    )
  }

  const projectOptions = (projects.data ?? []).map((project) => ({
    value: project.id,
    label: project.title,
  }))
  const projectIds = projectOptions.map((project) => project.value)
  const projectItems = [
    ...projectOptions,
    ...(targetProjectId !== '' &&
    !projectOptions.some((project) => project.value === targetProjectId)
      ? [{ value: targetProjectId, label: '…' }]
      : []),
  ]

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {rule ? '同期ルールを編集' : '同期ルールを追加'}
          </DialogTitle>
          <DialogDescription>
            GitHub issue のアサインをタスクとして同期する条件を設定します。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {rule ? (
            <>
              <FieldRow label="対象範囲">
                <span className="text-sm text-foreground">
                  {SCOPE_LABELS[rule.scope]}
                </span>
              </FieldRow>
              {rule.scope !== 'all' && (
                <FieldRow label="Organization">
                  <span className="font-mono text-sm text-foreground">
                    {rule.org}
                  </span>
                </FieldRow>
              )}
              {rule.scope === 'repo' && (
                <FieldRow label="リポジトリ">
                  <span className="font-mono text-sm text-foreground">
                    {rule.repo}
                  </span>
                </FieldRow>
              )}
            </>
          ) : (
            <>
              <FieldRow label="対象範囲">
                <SegmentedControl
                  value={scope}
                  options={SCOPE_OPTIONS}
                  onChange={setScope}
                  activeClassName="bg-secondary text-foreground"
                  inactiveClassName="text-muted-foreground hover:text-foreground"
                />
              </FieldRow>
              {scope !== 'all' && (
                <FieldRow label="Organization">
                  <Input
                    type="text"
                    value={org}
                    onChange={(e) => {
                      setOrg(e.target.value)
                    }}
                    placeholder="octocat"
                    className="h-auto w-full rounded-md border border-border bg-transparent dark:bg-transparent px-2 py-1 text-sm outline-none focus:border-primary/50 focus-visible:border-primary/50 focus-visible:ring-0"
                  />
                </FieldRow>
              )}
              {scope === 'repo' && (
                <FieldRow label="リポジトリ">
                  <Input
                    type="text"
                    value={repo}
                    onChange={(e) => {
                      setRepo(e.target.value)
                    }}
                    placeholder="hello-world"
                    className="h-auto w-full rounded-md border border-border bg-transparent dark:bg-transparent px-2 py-1 text-sm outline-none focus:border-primary/50 focus-visible:border-primary/50 focus-visible:ring-0"
                  />
                </FieldRow>
              )}
            </>
          )}

          <FieldRow label="反映先プロジェクト">
            <Select
              items={projectItems}
              value={targetProjectId}
              onValueChange={selectValueHandler(setTargetProjectId, projectIds)}
            >
              <SelectTrigger className="h-auto data-[size=default]:h-auto w-full border-0 bg-transparent dark:bg-transparent p-0 text-sm text-foreground shadow-none outline-none focus-visible:border-0 focus-visible:ring-0">
                <SelectValue placeholder="選択してください" />
              </SelectTrigger>
              <SelectContent>
                {projects.data?.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>

          {!rule && (
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox
                checked={includeExisting}
                onCheckedChange={setIncludeExisting}
                className="rounded border-border bg-transparent dark:bg-transparent"
              />
              現在アサイン済みの open issue も取り込む
            </label>
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
          <Button onClick={handleSubmit} disabled={!canSubmit || isPending}>
            {rule ? '保存' : '作成'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function FieldRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-xs font-medium text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  )
}
