import { writeFile } from 'node:fs/promises'

import { ResultAsync } from 'neverthrow'

import { FileIoError } from '#errors'

export function printJson(data: unknown): void {
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`)
}

function omitDeep(value: unknown, key: string): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => omitDeep(item, key))
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([k]) => k !== key)
        .map(([k, v]) => [k, omitDeep(v, key)]),
    )
  }
  return value
}

/**
 * Prints a list response as JSON, omitting `omitKey` (a long-text field
 * like `content`/`description`) from every item unless `full` is set —
 * keeps list output from flooding stdout with full page/comment bodies.
 */
export function printJsonList(
  data: unknown,
  omitKey: string,
  { full = false }: { full?: boolean | undefined } = {},
): void {
  printJson(full ? data : omitDeep(data, omitKey))
}

interface LinkSyncSummary {
  outgoing: { number: number; title: string }[]
  unresolvedRefs: (
    { kind: 'number'; value: number } | { kind: 'id'; value: string }
  )[]
}

// Surfaces task_links created/removed by a task/page/comment write, since
// the write itself gives no other sign that e.g. a GitHub PR number like
// `#76` in the body was parsed as a tq task reference. Written to stderr so
// stdout stays clean JSON for `| jq`.
export function printLinkSync(linkSync: LinkSyncSummary | undefined): void {
  if (linkSync == null) return

  const lines: string[] = []
  if (linkSync.outgoing.length > 0) {
    lines.push('Linked tasks:')
    for (const task of linkSync.outgoing) {
      lines.push(`  #${String(task.number)} ${task.title}`)
    }
  }
  if (linkSync.unresolvedRefs.length > 0) {
    const refs = linkSync.unresolvedRefs
      .map((ref) =>
        ref.kind === 'number' ? `#${String(ref.value)}` : ref.value,
      )
      .join(', ')
    lines.push(`Unresolved references (no matching task): ${refs}`)
  }

  if (lines.length === 0) return
  process.stderr.write(`${lines.join('\n')}\n`)
}

export function writeContentFile(
  filePath: string,
  content: string,
): ResultAsync<void, FileIoError> {
  return ResultAsync.fromPromise(
    writeFile(filePath, content, 'utf8'),
    (cause) => new FileIoError(`Failed to write ${filePath}`, cause),
  )
}

export function writeBinaryFile(
  filePath: string,
  data: Uint8Array,
): ResultAsync<void, FileIoError> {
  return ResultAsync.fromPromise(
    writeFile(filePath, data),
    (cause) => new FileIoError(`Failed to write ${filePath}`, cause),
  )
}
