import { MENTION_PATTERN } from '#constants/mention-pattern'

// Only safe to run against a single textblock run's masked text (see
// `extractMentionedTaskRefs` in task-link-references.ts) — a raw markdown
// string can still contain `#123` inside a code span or a link's display
// text, which isn't a real reference.
export function extractMentionedNumbers(text: string): number[] {
  const numbers = new Set<number>()
  for (const match of text.matchAll(MENTION_PATTERN)) {
    const [, digits] = match
    if (digits != null) numbers.add(Number(digits))
  }
  return [...numbers]
}
