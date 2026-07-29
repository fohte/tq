import { useState } from 'react'

import { GithubIssueLinkModal } from '#components/task/github-issue-link-modal'
import { GithubLinkBadge } from '#components/task/github-link-badge'
import { SidebarField } from '#components/task/sidebar-field'
import { GithubMarkIcon } from '#components/ui/github-mark-icon'
import type { GithubLink } from '#hooks/use-github-link'
import { useUnlinkTaskFromGithub } from '#hooks/use-github-link'

export function SidebarGithubLinkField({
  taskId,
  githubLink,
}: {
  taskId: string
  githubLink: GithubLink | null
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const unlink = useUnlinkTaskFromGithub(taskId)

  return (
    <SidebarField label="GitHub" icon={<GithubMarkIcon className="size-3.5" />}>
      {githubLink ? (
        <div className="flex items-center gap-1.5">
          <GithubLinkBadge link={githubLink} />
          <button
            type="button"
            onClick={() => {
              unlink.mutate()
            }}
            disabled={unlink.isPending}
            className="text-xs text-muted-foreground hover:text-destructive"
          >
            Unlink
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setModalOpen(true)
          }}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Link GitHub issue
        </button>
      )}

      <GithubIssueLinkModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        mode="link"
        taskId={taskId}
      />
    </SidebarField>
  )
}
