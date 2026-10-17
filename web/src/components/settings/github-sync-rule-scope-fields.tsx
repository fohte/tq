import { Input } from '@fohte/ui/input'

import type { SyncRule } from '#hooks/use-github-sync-rules'

export interface GithubSyncRuleScopeFieldsProps {
  scope: SyncRule['scope']
  org: string
  repo: string
  onOrgChange: (org: string) => void
  onRepoChange: (repo: string) => void
}

export function GithubSyncRuleScopeFields({
  scope,
  org,
  repo,
  onOrgChange,
  onRepoChange,
}: GithubSyncRuleScopeFieldsProps) {
  return (
    <>
      {scope !== 'all' && (
        <FieldRow label="Organization">
          <Input
            type="text"
            value={org}
            onChange={(event) => {
              onOrgChange(event.target.value)
            }}
            placeholder="octocat"
            className="w-full"
          />
        </FieldRow>
      )}
      {scope === 'repo' && (
        <FieldRow label="リポジトリ">
          <Input
            type="text"
            value={repo}
            onChange={(event) => {
              onRepoChange(event.target.value)
            }}
            placeholder="hello-world"
            className="w-full"
          />
        </FieldRow>
      )}
    </>
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
