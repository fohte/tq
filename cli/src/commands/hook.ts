import { appendFile, readFile } from 'node:fs/promises'

import { agentProviderSchema } from 'api/schemas/agent-session'
import { z } from 'zod'

import type { ReadableStdin } from '#input'
import { readContentInput } from '#input'
import {
  type OperationCommandContext,
  type OperationCommandHandler,
} from '#operation-adapter'
import { tryParseJson } from '#result'
import { resolveSessionLabel } from '#transcript'

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

type HookCommandContext = OperationCommandContext

export const hookOperationHandler: OperationCommandHandler = async (
  context,
) => {
  const event = context.input['event']
  if (typeof event !== 'string') return

  // Guards the whole pipeline, not just the fetch call: this command must
  // never fail, and a stream-level error on stdin would otherwise reject.
  await reportHookEvent(
    event,
    context.input,
    context.options['provider'],
    context.stdin,
    context.execute,
  ).catch(() => undefined)
}

async function reportHookEvent(
  event: string,
  inputOptions: HookCommandContext['input'],
  providerOption: unknown,
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
  const parsedProvider = agentProviderSchema.safeParse(providerOption)
  const provider = parsedProvider.success ? parsedProvider.data : 'claude_code'

  const transcript = await readTranscript(input.data.transcript_path)
  const { label, lastMessage } = resolveSessionLabel(
    transcript,
    input.data.cwd,
    provider,
  )

  await execute(
    {
      ...inputOptions,
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
