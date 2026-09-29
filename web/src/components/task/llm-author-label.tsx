import { Chip } from '#components/ui/chip'

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
    <Chip size="sm" className="shrink-0">
      {author.agent}
    </Chip>
  )
}
