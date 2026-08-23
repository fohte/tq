import { describe, expect, it } from 'vitest'

import { resolveSessionLabel } from '#transcript'

function jsonl(...entries: unknown[]): string {
  return entries.map((entry) => JSON.stringify(entry)).join('\n')
}

describe('resolveSessionLabel', () => {
  it('falls back to the cwd basename when the transcript has nothing usable', () => {
    expect(resolveSessionLabel('', '/home/user/ghq/example/app')).toEqual({
      label: 'app',
      lastMessage: null,
    })
  })

  it('uses the first user prompt when there is no title entry', () => {
    const transcript = jsonl(
      { type: 'user', message: { content: 'Fix the login bug' } },
      { type: 'user', message: { content: 'A follow-up question' } },
    )
    expect(resolveSessionLabel(transcript, '/home/user/app')).toEqual({
      label: 'Fix the login bug',
      lastMessage: null,
    })
  })

  it('prefers the last ai-title over the first user prompt', () => {
    const transcript = jsonl(
      { type: 'user', message: { content: 'Fix the login bug' } },
      { type: 'ai-title', aiTitle: 'Fix login redirect loop' },
      { type: 'ai-title', aiTitle: 'Fix login bug' },
    )
    expect(resolveSessionLabel(transcript, '/home/user/app')).toEqual({
      label: 'Fix login bug',
      lastMessage: null,
    })
  })

  it('prefers the last custom-title over ai-title and the first user prompt', () => {
    const transcript = jsonl(
      { type: 'user', message: { content: 'Fix the login bug' } },
      { type: 'ai-title', aiTitle: 'Fix login bug' },
      { type: 'custom-title', customTitle: 'Login fix' },
    )
    expect(resolveSessionLabel(transcript, '/home/user/app')).toEqual({
      label: 'Login fix',
      lastMessage: null,
    })
  })

  it('ignores an empty custom-title and falls through to ai-title', () => {
    const transcript = jsonl(
      { type: 'ai-title', aiTitle: 'Fix login bug' },
      { type: 'custom-title', customTitle: '   ' },
    )
    expect(resolveSessionLabel(transcript, '/home/user/app')).toEqual({
      label: 'Fix login bug',
      lastMessage: null,
    })
  })

  it('normalizes ANSI escapes and newlines in titles and the first prompt', () => {
    const transcript = jsonl({
      type: 'user',
      message: { content: '[31mFix[0m the bug\nplease' },
    })
    expect(resolveSessionLabel(transcript, '/home/user/app')).toEqual({
      label: 'Fix the bug please',
      lastMessage: null,
    })
  })

  it('extracts the last assistant text message, skipping tool_use-only turns', () => {
    const transcript = jsonl(
      {
        type: 'assistant',
        message: { content: [{ type: 'text', text: 'First reply' }] },
      },
      {
        type: 'assistant',
        message: { content: [{ type: 'tool_use', name: 'Bash' }] },
      },
      {
        type: 'assistant',
        message: { content: [{ type: 'text', text: 'Second reply' }] },
      },
    )
    expect(resolveSessionLabel(transcript, '/home/user/app')).toEqual({
      label: 'app',
      lastMessage: 'Second reply',
    })
  })

  it('joins multiple text blocks within a single assistant message', () => {
    const transcript = jsonl({
      type: 'assistant',
      message: {
        content: [
          { type: 'text', text: 'Part one.' },
          { type: 'tool_use', name: 'Bash' },
          { type: 'text', text: 'Part two.' },
        ],
      },
    })
    expect(resolveSessionLabel(transcript, '/home/user/app')).toEqual({
      label: 'app',
      lastMessage: 'Part one. Part two.',
    })
  })

  it('skips malformed JSON lines instead of failing the whole scan', () => {
    const transcript = [
      'not json',
      JSON.stringify({ type: 'ai-title', aiTitle: 'Recovered title' }),
    ].join('\n')
    expect(resolveSessionLabel(transcript, '/home/user/app')).toEqual({
      label: 'Recovered title',
      lastMessage: null,
    })
  })
})
