import { describe, expect, it } from 'vitest'

import {
  canOpenSessionLocally,
  resolveSessionOpenAction,
} from '#lib/session-open'

describe('canOpenSessionLocally', () => {
  it('allows every session when the local context is unset', () => {
    expect(canOpenSessionLocally('work', null)).toBe(true)
    expect(canOpenSessionLocally('personal', null)).toBe(true)
  })

  it('allows a session whose context matches the local context', () => {
    expect(canOpenSessionLocally('work', 'work')).toBe(true)
  })

  it('rejects a session whose context does not match the local context', () => {
    expect(canOpenSessionLocally('personal', 'work')).toBe(false)
  })
})

describe('resolveSessionOpenAction', () => {
  it('falls back to copying the resume command when no template is set', () => {
    const result = resolveSessionOpenAction('session-1', true, {
      focusUrlTemplate: null,
      resumeUrlTemplate: null,
    })

    expect(result).toEqual({ kind: 'copy', text: 'claude --resume session-1' })
  })

  it('falls back to the same copy command for an ended session', () => {
    const result = resolveSessionOpenAction('session-1', false, {
      focusUrlTemplate: null,
      resumeUrlTemplate: null,
    })

    expect(result).toEqual({ kind: 'copy', text: 'claude --resume session-1' })
  })

  it('expands the focus template for an active session', () => {
    const result = resolveSessionOpenAction('session-1', true, {
      focusUrlTemplate: 'hammerspoon://cc-focus?session={sessionId}',
      resumeUrlTemplate: 'hammerspoon://cc-resume?session={sessionId}',
    })

    expect(result).toEqual({
      kind: 'url',
      url: 'hammerspoon://cc-focus?session=session-1',
    })
  })

  it('expands the resume template for an ended session', () => {
    const result = resolveSessionOpenAction('session-1', false, {
      focusUrlTemplate: 'hammerspoon://cc-focus?session={sessionId}',
      resumeUrlTemplate: 'hammerspoon://cc-resume?session={sessionId}',
    })

    expect(result).toEqual({
      kind: 'url',
      url: 'hammerspoon://cc-resume?session=session-1',
    })
  })

  it('URL-encodes the session id inside the template', () => {
    const result = resolveSessionOpenAction('a/b c', true, {
      focusUrlTemplate: 'tq://focus?session={sessionId}',
      resumeUrlTemplate: null,
    })

    expect(result).toEqual({
      kind: 'url',
      url: 'tq://focus?session=a%2Fb%20c',
    })
  })
})
