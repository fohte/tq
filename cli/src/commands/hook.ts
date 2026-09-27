import { appendFile, readFile } from 'node:fs/promises'

import { hookOperations } from 'api/operations'
import {
  agentProviderSchema,
  upsertAgentSessionSchema,
} from 'api/schemas/agent-session'
import type { Command } from 'commander'
import { z } from 'zod'

import type { ReadableStdin } from '#input'
import { readContentInput } from '#input'
import {
  type OperationCommandHandler,
  registerOperations,
} from '#operation-adapter'
import { tryParseJson } from '#result'
import { pickSchemaFields } from '#schema-options'
import { resolveSessionLabel } from '#transcript'

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

async function readTranscript(
  transcriptPath: string | undefined,
): Promise<string> {
  if (transcriptPath == null) return ''
  return readFile(transcriptPath, 'utf8').catch(() => '')
}

// CLAUDE_ENV_FILE is only set by Claude Code during SessionStart (and a few
// other lifecycle hooks tq doesn't use). Appending an `export` line here
// makes TQ_SESSION_ID available to every Bash command for the rest of the
// session, which is how `tq link`/`tq unlink` find their own session_id:
// https://code.claude.com/docs/en/hooks#persist-environment-variables
async function persistSessionIdToEnvFile(sessionId: string): Promise<void> {
  const envFile = process.env['CLAUDE_ENV_FILE']
  if (envFile == null || envFile.length === 0) return

  const quoted = sessionId.replace(/'/g, `'\\''`)
  await appendFile(envFile, `export TQ_SESSION_ID='${quoted}'\n`, 'utf8').catch(
    () => undefined,
  )
}

type HookCommandContext = Parameters<OperationCommandHandler>[0]

export const handleHookCommand: OperationCommandHandler = async (context) => {
  const event = context.input['event']
  if (typeof event !== 'string') return

  // Guards the whole pipeline, not just the fetch call: this command must
  // never fail, and a stream-level error on stdin would otherwise reject.
  await reportHookEvent(
    event,
    context.options,
    context.stdin,
    context.execute,
  ).catch(() => undefined)
}

async function reportHookEvent(
  event: string,
  options: HookCommandContext['options'],
  stdin: ReadableStdin,
  execute: HookCommandContext['execute'],
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

  if (event === 'SessionStart') {
    await persistSessionIdToEnvFile(input.data.session_id)
  }

  // The `: 'claude_code'` branch is only a fallback: the --provider option
  // validates explicit values before this handler runs.
  const parsedProvider = agentProviderSchema.safeParse(options['provider'])
  const provider = parsedProvider.success ? parsedProvider.data : 'claude_code'

  const transcript = await readTranscript(input.data.transcript_path)
  const { label, lastMessage } = resolveSessionLabel(
    transcript,
    input.data.cwd,
    provider,
  )

  const additionalInput = pickSchemaFields(
    upsertAgentSessionSchema,
    options,
    HOOK_MANAGED_FIELDS,
  ).match(
    (value) => value,
    () => ({}),
  )

  await execute(
    {
      ...additionalInput,
      event,
      provider,
      sessionId: input.data.session_id,
      cwd: input.data.cwd,
      label,
      lastMessage,
      ended: event === 'SessionEnd',
    },
    { ignoreErrors: true },
  )
}

export function registerHookCommands(
  program: Command,
  fetchImpl: typeof fetch,
  stdin: ReadableStdin,
): void {
  registerOperations(
    program,
    hookOperations,
    'Report coding agent hook events to tq',
    fetchImpl,
    stdin,
    handleHookCommand,
  )
}
