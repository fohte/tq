import { GithubLinkBadge } from '#components/task/github-link-badge'
import { GithubRefSummary } from '#components/task/github-ref-summary'
import {
  PreviewCard,
  PreviewCardPortal,
  PreviewCardPositioner,
  PreviewCardTrigger,
  PreviewListPopup,
} from '#components/ui/preview-card'
import type { GithubLink } from '#hooks/use-github-link'

// Prefers the latest linked PR over the latest issue, since a PR is what
// actually implements the task.
function pickRepresentativeGithubLink(links: GithubLink[]): GithubLink | null {
  return (
    links.findLast((link) => link.kind === 'pull_request') ??
    links.at(-1) ??
    null
  )
}

export function GithubLinksChipGroup({ links }: { links: GithubLink[] }) {
  const representative = pickRepresentativeGithubLink(links)
  if (representative == null) return null

  if (links.length === 1) {
    return <GithubLinkBadge link={representative} />
  }

  return (
    <PreviewCard>
      <PreviewCardTrigger render={<span />} data-testid="github-links-chip">
        <GithubLinkBadge link={representative} extraCount={links.length - 1} />
      </PreviewCardTrigger>
      <PreviewCardPortal>
        <PreviewCardPositioner>
          <PreviewListPopup label="GITHUB" count={links.length}>
            {links.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-sm last:border-b-0"
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
            ))}
          </PreviewListPopup>
        </PreviewCardPositioner>
      </PreviewCardPortal>
    </PreviewCard>
  )
}
