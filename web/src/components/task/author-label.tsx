import { Chip } from '@fohte/ui/chip'

export interface AuthorInfo {
  kind: 'human' | 'llm' | 'service' | 'system'
  agent: string | null
}

export function formatServiceAuthor(agent: string | null): string {
  return `service: ${agent ?? 'unknown'}`
}

// Human is the implicit default; only named non-human authors need a label.
export function AuthorLabel({
  author,
  compact = false,
}: {
  author: AuthorInfo | null | undefined
  compact?: boolean
}) {
  if (author?.kind === 'llm') {
    return (
      <span className="shrink-0">
        <Chip size="sm">{author.agent}</Chip>
      </span>
    )
  }

  if (author?.kind === 'service') {
    const label = formatServiceAuthor(author.agent)

    return (
      <span className="shrink-0">
        <Chip size="sm">
          <span
            className={
              compact ? 'block max-w-28 truncate sm:max-w-none' : undefined
            }
            title={label}
          >
            {label}
          </span>
        </Chip>
      </span>
    )
  }

  return null
}
