import { useState } from 'react'

import { GithubIssueLinkModal } from '#components/task/github-issue-link-modal'
import { GithubLinkBadge } from '#components/task/github-link-badge'
import { SidebarField } from '#components/task/sidebar-field'
import { Button } from '#components/ui/button'
import type { GithubLink } from '#hooks/use-github-link'
import { useUnlinkTaskFromGithub } from '#hooks/use-github-link'

export function SidebarGithubLinkField({
  taskId,
  githubLinks,
}: {
  taskId: string
  githubLinks: GithubLink[]
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const unlink = useUnlinkTaskFromGithub(taskId)
  const githubLink = githubLinks[0] ?? null

  return (
    <SidebarField label="GITHUB">
      {githubLink ? (
        <div className="flex items-center gap-1.5">
          <GithubLinkBadge link={githubLink} />
          <Button
            type="button"
            variant="link"
            size="xs"
            className="h-auto p-0 text-muted-foreground-faint hover:text-destructive"
            onClick={() => {
              unlink.mutate(githubLink.id)
            }}
            disabled={unlink.isPending}
          >
            unlink
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="link"
          size="xs"
          className="h-auto p-0 text-muted-foreground-faint hover:text-foreground"
          onClick={() => {
            setModalOpen(true)
          }}
        >
          link issue
        </Button>
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
