import { basename } from 'node:path'

import { tryParseJson } from '#result'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normalize(text: string): string {
  return text
    .replace(/\x1b\[[0-9;]*[A-Za-z]/g, '')
    .replace(/[\r\n]+/g, ' ')
    .trim()
}

function textFromContentBlocks(
  content: unknown,
  textTypes: readonly string[],
): string | undefined {
  if (!Array.isArray(content)) return undefined
  const texts = content
    .filter(isRecord)
    .filter((block) => {
      const type = block['type']
      return typeof type === 'string' && textTypes.includes(type)
    })
    .map((block) => block['text'])
    .filter((text): text is string => typeof text === 'string')
  return texts.length > 0 ? texts.join(' ') : undefined
}

export interface ResolvedSession {
  label: string
  lastMessage: string | null
}

export type AgentProvider = 'claude_code' | 'codex'

const MAX_LABEL_LENGTH = 120

function truncate(text: string): string {
  return text.length > MAX_LABEL_LENGTH
    ? `${text.slice(0, MAX_LABEL_LENGTH)}…`
    : text
}

/**
 * Resolves a session's display label and last assistant message from its
 * transcript (.jsonl content). `provider` picks the transcript dialect to
 * parse: Claude Code and Codex use unrelated JSONL shapes.
 */
export function resolveSessionLabel(
  transcript: string,
  cwd: string,
  provider: AgentProvider = 'claude_code',
): ResolvedSession {
  return provider === 'codex'
    ? resolveCodexSessionLabel(transcript, cwd)
    : resolveClaudeCodeSessionLabel(transcript, cwd)
}

/**
 * Priority order: the last `custom-title` entry (a user-set name) > the
 * last `ai-title` entry (Claude Code's generated title) > the first user
 * prompt > cwd's basename.
 */
function resolveClaudeCodeSessionLabel(
  transcript: string,
  cwd: string,
): ResolvedSession {
  let lastCustomTitle: string | undefined
  let lastAiTitle: string | undefined
  let firstUserPrompt: string | undefined
  let lastAssistantMessage: string | undefined

  for (const line of transcript.split('\n')) {
    if (line.length === 0) continue
    const parsed = tryParseJson(line)
    if (parsed.isErr() || !isRecord(parsed.value)) continue
    const entry = parsed.value

    if (
      entry['type'] === 'custom-title' &&
      typeof entry['customTitle'] === 'string'
    ) {
      const title = normalize(entry['customTitle'])
      if (title.length > 0) lastCustomTitle = title
    } else if (
      entry['type'] === 'ai-title' &&
      typeof entry['aiTitle'] === 'string'
    ) {
      const title = normalize(entry['aiTitle'])
      if (title.length > 0) lastAiTitle = title
    } else if (
      entry['type'] === 'user' &&
      firstUserPrompt === undefined &&
      isRecord(entry['message']) &&
      typeof entry['message']['content'] === 'string'
    ) {
      const text = normalize(entry['message']['content'])
      if (text.length > 0) firstUserPrompt = text
    } else if (entry['type'] === 'assistant' && isRecord(entry['message'])) {
      const text = textFromContentBlocks(entry['message']['content'], ['text'])
      if (text !== undefined) {
        const normalized = normalize(text)
        if (normalized.length > 0) lastAssistantMessage = normalized
      }
    }
  }

  return {
    label: truncate(
      lastCustomTitle ?? lastAiTitle ?? firstUserPrompt ?? basename(cwd),
    ),
    lastMessage: lastAssistantMessage ?? null,
  }
}

// Before the real first user turn, Codex inserts synthetic `role: "user"`
// response_items carrying its own AGENTS.md instructions and environment
// context, not anything the user typed — confirmed across every rollout
// file under ~/.codex/sessions. Both prefixes must be skipped, or the
// label ends up being Codex's own instructions text instead of the task.
const CODEX_SYNTHETIC_USER_PREFIXES = [
  '# AGENTS.md instructions for ',
  '<environment_context>',
]

/**
 * Codex has no title concept, so the label is the first real user
 * message. Each rollout line is `{ type: 'response_item', payload: {
 * type: 'message', role, content: [...] } }`; the message text sits in
 * `input_text` blocks for the user and `output_text` blocks for the
 * assistant.
 */
function resolveCodexSessionLabel(
  transcript: string,
  cwd: string,
): ResolvedSession {
  let firstUserPrompt: string | undefined
  let lastAssistantMessage: string | undefined

  for (const line of transcript.split('\n')) {
    if (line.length === 0) continue
    const parsed = tryParseJson(line)
    if (parsed.isErr() || !isRecord(parsed.value)) continue
    const entry = parsed.value
    if (entry['type'] !== 'response_item' || !isRecord(entry['payload']))
      continue
    const payload = entry['payload']
    if (payload['type'] !== 'message') continue

    if (payload['role'] === 'user' && firstUserPrompt === undefined) {
      const text = textFromContentBlocks(payload['content'], ['input_text'])
      if (text !== undefined) {
        const normalized = normalize(text)
        const isSynthetic = CODEX_SYNTHETIC_USER_PREFIXES.some((prefix) =>
          normalized.startsWith(prefix),
        )
        if (normalized.length > 0 && !isSynthetic) {
          firstUserPrompt = normalized
        }
      }
    } else if (payload['role'] === 'assistant') {
      const text = textFromContentBlocks(payload['content'], ['output_text'])
      if (text !== undefined) {
        const normalized = normalize(text)
        if (normalized.length > 0) lastAssistantMessage = normalized
      }
    }
  }

  return {
    label: truncate(firstUserPrompt ?? basename(cwd)),
    lastMessage: lastAssistantMessage ?? null,
  }
}
