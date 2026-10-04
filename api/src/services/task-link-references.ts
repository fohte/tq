import { captureWithFingerprint } from '@fohte/service-kit/observability'

import { APP_DOMAIN } from '#env'
import { extractAppResourceRefs } from '#lib/app-url'
import { parseMarkdown } from '#lib/markdown-parser'
import type { NumericOrId } from '#lib/numeric-id'
import { collectTextBlockRuns } from '#lib/text-scan'
import { extractMentionedNumbers } from '#services/task-mention-numbers'

function dedupeRefs(refs: Iterable<NumericOrId>): NumericOrId[] {
  const numbers = new Set<number>()
  const ids = new Set<string>()
  for (const ref of refs) {
    if (ref.kind === 'number') {
      numbers.add(ref.value)
    } else {
      ids.add(ref.value)
    }
  }
  return [
    ...[...numbers].map((value): NumericOrId => ({ kind: 'number', value })),
    ...[...ids].map((value): NumericOrId => ({ kind: 'id', value })),
  ]
}

// Combines `#123`-style mentions with `https://<APP_DOMAIN>/tasks/...`-style
// URLs pasted into task text. A task URL may key off either the human-facing
// number or the UUID primary key (see `findTaskByIdOrNumber`), so a numeric
// URL ref is folded in alongside `#123` mentions as the same `kind: 'number'`.
//
// Parses `text` into the same ProseMirror doc shape the frontend editor
// produces and runs the regex matchers per textblock run rather than against
// the raw string, so a `#123` inside a code span, a code block, or a link's
// display text (masked by `collectTextBlockRuns`, shared with `web` via the
// `api` package) is excluded the same way it is in the editor.
export async function extractMentionedTaskRefs(
  text: string,
): Promise<NumericOrId[]> {
  const parsed = await parseMarkdown(text)
  if (parsed.isErr()) {
    // A pathological field (e.g. deeply nested blockquotes) must not turn an
    // otherwise-successful task/page/comment write into a failed sync — this
    // field just contributes no refs.
    captureWithFingerprint(parsed.error, 'api.task-links.parse-failed')
    return []
  }
  const doc = parsed.value
  const refs: NumericOrId[] = []
  for (const run of collectTextBlockRuns(doc)) {
    for (const value of extractMentionedNumbers(run.text)) {
      refs.push({ kind: 'number', value })
    }
    for (const ref of extractAppResourceRefs(run.text, APP_DOMAIN, 'tasks')) {
      refs.push(ref)
    }
    // A labeled link's href is masked out of `run.text` (see text-scan.ts);
    // scan it via this side channel instead.
    for (const href of run.hrefs) {
      for (const ref of extractAppResourceRefs(href, APP_DOMAIN, 'tasks')) {
        refs.push(ref)
      }
    }
  }
  return dedupeRefs(refs)
}

export { dedupeRefs }
