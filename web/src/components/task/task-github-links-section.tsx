import { X } from 'lucide-react'
import { useState } from 'react'

import { GithubIssueLinkModal } from '#components/task/github-issue-link-modal'
import { GithubRefSummary } from '#components/task/github-ref-summary'
import { Button } from '#components/ui/button'
import { SectionHeading } from '#components/ui/section-heading'
import type { GithubLink } from '#hooks/use-github-link'
import { useUnlinkTaskFromGithub } from '#hooks/use-github-link'

export function TaskGithubLinksSection({
  taskId,
  githubLinks,
}: {
  taskId: string
  githubLinks: GithubLink[]
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const unlink = useUnlinkTaskFromGithub(taskId)

  return (
    <div className="flex flex-col gap-2.5">
      <SectionHeading level={3}>github</SectionHeading>

      {githubLinks.length > 0 && (
        <div className="flex flex-col gap-1">
          {githubLinks.map((link) => (
            <div key={link.id} className="flex items-center gap-2">
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-0 flex-1 items-center gap-2 text-sm hover:underline"
              >
                <GithubRefSummary
                  kind={link.kind}
                  state={link.state}
                  owner={link.owner}
                  repo={link.repo}
                  number={link.number}
                  title={link.title}
                />
              </a>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => {
                  unlink.mutate(link.id)
                }}
                disabled={unlink.isPending}
                aria-label={`Unlink ${link.owner}/${link.repo}#${String(link.number)}`}
                className="shrink-0 text-muted-foreground-faint hover:text-destructive"
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="link"
        size="xs"
        className="h-auto w-fit p-0 text-muted-foreground-faint hover:text-foreground"
        onClick={() => {
          setModalOpen(true)
        }}
      >
        link issue or PR
      </Button>

      <GithubIssueLinkModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        mode="link"
        taskId={taskId}
      />
    </div>
  )
}
