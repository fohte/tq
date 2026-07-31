import { ArrowRight } from 'lucide-react'
import { useState } from 'react'

import { GithubSyncRuleFormModal } from '#components/settings/github-sync-rule-form-modal'
import { Button } from '#components/ui/button'
import { DeleteConfirmButton } from '#components/ui/delete-confirm-button'
import { SegmentedControl } from '#components/ui/segmented-control'
import type { SyncRule } from '#hooks/use-github-sync-rules'
import {
  useDeleteGithubSyncRule,
  useUpdateGithubSyncRule,
} from '#hooks/use-github-sync-rules'
import type { Project } from '#hooks/use-projects'

function scopeDescription(rule: Pick<SyncRule, 'scope' | 'org' | 'repo'>) {
  switch (rule.scope) {
    case 'all':
      return 'すべてのリポジトリ'
    case 'org':
      return (
        <>
          org <span className="font-mono">{rule.org}</span>
        </>
      )
    case 'repo':
      return (
        <span className="font-mono">
          {rule.org}/{rule.repo}
        </span>
      )
  }
}

function resolveProjectTitle(
  projects: Project[] | undefined,
  targetProjectId: string,
) {
  return (
    projects?.find((project) => project.id === targetProjectId)?.title ??
    '(不明なプロジェクト)'
  )
}

const ENABLED_STATE_OPTIONS = [
  { value: 'enabled', label: '有効' },
  { value: 'disabled', label: '無効' },
] as const satisfies ReadonlyArray<{
  value: 'enabled' | 'disabled'
  label: string
}>

export interface GithubSyncRuleRowProps {
  rule: SyncRule
  projects: Project[] | undefined
}

export function GithubSyncRuleRow({ rule, projects }: GithubSyncRuleRowProps) {
  const [editOpen, setEditOpen] = useState(false)

  const updateRule = useUpdateGithubSyncRule()
  const deleteRule = useDeleteGithubSyncRule()

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground">
          {scopeDescription(rule)}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          アサインされたら
          <ArrowRight className="size-3" />
          {resolveProjectTitle(projects, rule.targetProjectId)}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <SegmentedControl
          value={rule.enabled ? 'enabled' : 'disabled'}
          options={ENABLED_STATE_OPTIONS}
          onChange={(value) => {
            if (updateRule.isPending) return
            updateRule.mutate({
              id: rule.id,
              input: { enabled: value === 'enabled' },
            })
          }}
          containerClassName="rounded-md bg-secondary p-0.5"
          activeClassName="bg-background text-foreground shadow-sm"
          inactiveClassName="text-muted-foreground hover:text-foreground"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setEditOpen(true)
          }}
        >
          編集
        </Button>
        <DeleteConfirmButton
          title="同期ルールを削除"
          description="この同期ルールを削除しますか? この操作は取り消せません。"
          onDelete={() => {
            deleteRule.mutate(rule.id)
          }}
          disabled={deleteRule.isPending}
        />
      </div>

      <GithubSyncRuleFormModal
        open={editOpen}
        onOpenChange={setEditOpen}
        rule={rule}
      />
    </div>
  )
}
