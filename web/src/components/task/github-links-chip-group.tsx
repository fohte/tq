import { GithubLinkBadge } from '#components/task/github-link-badge'
import { GithubRefSummary } from '#components/task/github-ref-summary'
import {
  PreviewCard,
  PreviewCardPopup,
  PreviewCardPortal,
  PreviewCardPositioner,
  PreviewCardTrigger,
} from '#components/ui/preview-card'
import type { GithubLink } from '#hooks/use-github-link'

// The chip row / list row only has room for one representative link, so we
// pick the one most likely to answer "what implements this": the latest PR,
// or the latest issue when there's no PR yet.
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
          <PreviewCardPopup className="w-(--width-preview-popup) p-0">
            <div className="border-b border-border px-3 py-1.5 font-mono text-2xs tracking-widest text-muted-foreground-faint">
              GITHUB ({links.length})
            </div>
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
          </PreviewCardPopup>
        </PreviewCardPositioner>
      </PreviewCardPortal>
    </PreviewCard>
  )
}
