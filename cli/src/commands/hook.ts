import { readFile } from 'node:fs/promises'

import { upsertAgentSessionSchema } from 'api/schemas/agent-session'
import type { Command } from 'commander'
import type { InferRequestType } from 'hono/client'
import { Result } from 'neverthrow'
import { z } from 'zod'

import type { Client } from '#client'
import { buildClient } from '#command-context'
import type { ReadableStdin } from '#input'
import { readContentInput } from '#input'
import { fail } from '#result'
import { addSchemaOptions, pickSchemaFields } from '#schema-options'
import { resolveSessionLabel } from '#transcript'

type UpsertAgentSessionJson = InferRequestType<
  Client['api']['agent-sessions']['$post']
>['json']

// Fields tq's hook integration sets itself (from the hook input JSON or the
// resolved transcript), as opposed to `context`, the only field left for
// addSchemaOptions to expose as a flag/env default.
const HOOK_MANAGED_FIELDS = [
  'provider',
  'sessionId',
  'cwd',
  'label',
  'lastMessage',
  'ended',
] as const

// Claude Code's hook input carries more fields than this (source,
// notification_type, tool_name, ...), but SessionStart/Stop/SessionEnd only
// ever need these three: https://code.claude.com/docs/en/hooks.md
const hookInputSchema = z.object({
  session_id: z.string().min(1),
  cwd: z.string().min(1),
  transcript_path: z.string().optional(),
})

const tryParseJson = Result.fromThrowable((text: string): unknown =>
  JSON.parse(text),
)

async function readTranscript(
  transcriptPath: string | undefined,
): Promise<string> {
  if (transcriptPath == null) return ''
  return readFile(transcriptPath, 'utf8').catch(() => '')
}

export function registerHookCommands(
  program: Command,
  fetchImpl: typeof fetch,
  stdin: ReadableStdin,
): void {
  const hook = addSchemaOptions(
    program
      .command('hook <event>')
      .description(
        'Report a Claude Code hook event (SessionStart, Stop, SessionEnd) to tq, reading the hook JSON payload from stdin. Never fails: a broken connection or malformed input is swallowed silently so it never blocks Claude Code.',
      ),
    upsertAgentSessionSchema,
    HOOK_MANAGED_FIELDS,
    { context: 'TQ_CONTEXT' },
  ).match(
    (command) => command,
    (error) => fail(program, error),
  )

  hook.action(
    async (
      event: string,
      options: Record<string, unknown>,
      command: Command,
    ) => {
      await reportHookEvent(event, options, fetchImpl, stdin, command)
    },
  )
}

async function reportHookEvent(
  event: string,
  options: Record<string, unknown>,
  fetchImpl: typeof fetch,
  stdin: ReadableStdin,
  command: Command,
): Promise<void> {
  const raw = await readContentInput(undefined, stdin).match(
    (value) => value,
    () => undefined,
  )
  if (raw == null) return

  const parsed = tryParseJson(raw)
  if (parsed.isErr()) return

  const input = hookInputSchema.safeParse(parsed.value)
  if (!input.success) return

  const transcript = await readTranscript(input.data.transcript_path)
  const { label, lastMessage } = resolveSessionLabel(transcript, input.data.cwd)

  const client = buildClient(command, fetchImpl).match(
    (value) => value,
    () => undefined,
  )
  if (client == null) return

  const json: UpsertAgentSessionJson = {
    ...pickSchemaFields(upsertAgentSessionSchema, options, [
      ...HOOK_MANAGED_FIELDS,
    ]).match(
      (value) => value,
      () => ({}),
    ),
    provider: 'claude_code',
    sessionId: input.data.session_id,
    cwd: input.data.cwd,
    label,
    lastMessage,
    ended: event === 'SessionEnd',
  }

  await client.api['agent-sessions'].$post({ json }).catch(() => undefined)
}
