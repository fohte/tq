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

function textFromContentBlocks(content: unknown): string | undefined {
  if (!Array.isArray(content)) return undefined
  const texts = content
    .filter(isRecord)
    .filter((block) => block['type'] === 'text')
    .map((block) => block['text'])
    .filter((text): text is string => typeof text === 'string')
  return texts.length > 0 ? texts.join(' ') : undefined
}

export interface ResolvedSession {
  label: string
  lastMessage: string | null
}

const MAX_LABEL_LENGTH = 120

function truncate(text: string): string {
  return text.length > MAX_LABEL_LENGTH
    ? `${text.slice(0, MAX_LABEL_LENGTH)}…`
    : text
}

/**
 * Resolves a session's display label and last assistant message from its
 * Claude Code transcript (.jsonl content). Priority order: the last
 * `custom-title` entry (a user-set name) > the last `ai-title` entry
 * (Claude Code's generated title) > the first user prompt > cwd's basename.
 */
export function resolveSessionLabel(
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
      const text = textFromContentBlocks(entry['message']['content'])
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
