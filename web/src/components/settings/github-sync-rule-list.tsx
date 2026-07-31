import { Plus } from 'lucide-react'
import { useState } from 'react'

import { GithubSyncRuleFormModal } from '#components/settings/github-sync-rule-form-modal'
import { GithubSyncRuleRow } from '#components/settings/github-sync-rule-row'
import { Button } from '#components/ui/button'
import { useGithubSyncRules } from '#hooks/use-github-sync-rules'
import { useProjects } from '#hooks/use-projects'

export function GithubSyncRuleList() {
  const [createOpen, setCreateOpen] = useState(false)

  const syncRules = useGithubSyncRules()
  const projects = useProjects()

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">同期ルール</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setCreateOpen(true)
          }}
        >
          <Plus className="size-3.5" />
          追加
        </Button>
      </div>

      {syncRules.isLoading ? (
        <p className="text-sm text-muted-foreground">読み込み中...</p>
      ) : syncRules.isSuccess ? (
        syncRules.data.length > 0 ? (
          <div className="flex flex-col gap-3">
            {syncRules.data.map((rule) => (
              <GithubSyncRuleRow
                key={rule.id}
                rule={rule}
                projects={projects.data}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            同期ルールはまだありません
          </p>
        )
      ) : (
        <p className="text-sm text-destructive">
          同期ルールの取得に失敗しました
        </p>
      )}

      <GithubSyncRuleFormModal open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}
