import { Chip } from '@fohte/ui/chip'

export interface AuthorInfo {
  kind: 'human' | 'llm' | 'system'
  agent: string | null
}

// Human is the implicit default, so only an LLM author renders anything —
// this must stay invisible for human/system authors and missing data.
export function LlmAuthorLabel({
  author,
}: {
  author: AuthorInfo | null | undefined
}) {
  if (author?.kind !== 'llm') return null

  return (
    <span className="shrink-0">
      <Chip size="sm">{author.agent}</Chip>
    </span>
  )
}
