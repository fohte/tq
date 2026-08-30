import { SidebarField } from '#components/task/sidebar-field'
import type { GithubLink } from '#hooks/use-github-link'

export function SidebarGithubLinkField({
  githubLinks,
}: {
  githubLinks: GithubLink[]
}) {
  const count = githubLinks.length

  return (
    <SidebarField label="GITHUB">
      <span className="text-muted-foreground">
        {count === 0 ? '—' : `${String(count)} link${count === 1 ? '' : 's'}`}
      </span>
    </SidebarField>
  )
}
