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
    <span className="inline-flex shrink-0 items-center rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
      {author.agent}
    </span>
  )
}
