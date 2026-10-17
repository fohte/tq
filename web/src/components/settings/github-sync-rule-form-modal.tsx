import { Button } from '@fohte/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@fohte/ui/dialog'
import { SegmentedControl } from '@fohte/ui/segmented-control'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@fohte/ui/select'
import { useState } from 'react'

import { GithubSyncRuleScopeFields } from '#components/settings/github-sync-rule-scope-fields'
import { Checkbox } from '#components/ui/checkbox'
import type { SyncRule } from '#hooks/use-github-sync-rules'
import {
  useCreateGithubSyncRule,
  useUpdateGithubSyncRule,
} from '#hooks/use-github-sync-rules'
import { ALL_PROJECTS_FILTER, useProjects } from '#hooks/use-projects'
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

  const projects = useProjects(ALL_PROJECTS_FILTER)
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
                  onValueChange={setScope}
                />
              </FieldRow>
              <GithubSyncRuleScopeFields
                scope={scope}
                org={org}
                repo={repo}
                onOrgChange={setOrg}
                onRepoChange={setRepo}
              />
            </>
          )}

          <FieldRow label="反映先プロジェクト">
            <Select
              items={projectItems}
              value={targetProjectId}
              onValueChange={selectValueHandler(setTargetProjectId, projectIds)}
            >
              <SelectTrigger variant="ghost" className="w-full">
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
