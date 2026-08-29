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

type RefSource =
  | { kind: 'description' }
  | { kind: 'page'; id: string; title: string }
  | { kind: 'comment'; id: string }

interface LinkSyncSummary {
  outgoing: { number: number; title: string }[]
  unresolvedRefs: ((
    { kind: 'number'; value: number } | { kind: 'id'; value: string }
  ) & { sources: RefSource[] })[]
}

// Task titles are free text (e.g. set via the web UI or MCP), so a title
// containing a raw control/escape character must not reach the terminal
// unescaped here — unlike every other CLI output, which goes through
// JSON.stringify via printJson.
function stripControlChars(text: string): string {
  return text.replace(/[\x00-\x1f\x7f-\x9f]/g, '')
}

function formatRefSource(source: RefSource): string {
  switch (source.kind) {
    case 'description':
      return 'description'
    case 'page':
      return `page "${stripControlChars(source.title)}"`
    case 'comment':
      return `comment ${source.id}`
  }
}

// Surfaces the task_links a write just created, since the write itself gives
// no other sign that e.g. a GitHub PR number like `#76` in the body was
// parsed as a tq task reference. Written to stderr so stdout stays clean
// JSON for `| jq`.
export function printLinkSync(linkSync: LinkSyncSummary | undefined): void {
  if (linkSync == null) return

  const lines: string[] = []
  if (linkSync.outgoing.length > 0) {
    lines.push('Linked tasks:')
    for (const task of linkSync.outgoing) {
      lines.push(`  #${String(task.number)} ${stripControlChars(task.title)}`)
    }
  }
  if (linkSync.unresolvedRefs.length > 0) {
    lines.push('Task references with no matching task:')
    for (const ref of linkSync.unresolvedRefs) {
      const value = ref.kind === 'number' ? `#${String(ref.value)}` : ref.value
      const sources = ref.sources.map(formatRefSource).join(', ')
      lines.push(`  ${value} in ${sources}`)
    }
    lines.push(
      "If these aren't tq task numbers, write them as a link or in backticks.",
    )
  }

  if (lines.length === 0) return
  process.stderr.write(`${lines.join('\n')}\n`)
}

// Every task/page/comment write action prints its JSON body to stdout and
// then, if the write triggered a task_links resync, the linkSync summary to
// stderr — combined here so a future write endpoint can't add the former
// while forgetting the latter.
export function printJsonWithLinkSync(data: {
  linkSync?: LinkSyncSummary | undefined
}): void {
  printJson(data)
  printLinkSync(data.linkSync)
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
