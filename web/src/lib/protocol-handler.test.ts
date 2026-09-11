import { describe, expect, it } from 'vitest'

import { resolveProtocolHandlerTarget } from '#lib/protocol-handler'

describe('resolveProtocolHandlerTarget', () => {
  it('resolves a task link to the task route', () => {
    expect(resolveProtocolHandlerTarget('web+tq://tasks/123')).toEqual({
      to: '/tasks/$taskId',
      params: { taskId: '123' },
    })
  })

  it('ignores a query string on a task link', () => {
    expect(resolveProtocolHandlerTarget('web+tq://tasks/123?foo=bar')).toEqual({
      to: '/tasks/$taskId',
      params: { taskId: '123' },
    })
  })

  it('falls back to the top for a non-web+tq protocol', () => {
    expect(resolveProtocolHandlerTarget('https://tasks/123')).toEqual({
      to: '/',
    })
  })

  it('falls back to the top for a path with more than one segment', () => {
    expect(resolveProtocolHandlerTarget('web+tq://tasks/123/456')).toEqual({
      to: '/',
    })
  })

  it('falls back to the top for a triple-slash open-redirect attempt', () => {
    expect(resolveProtocolHandlerTarget('web+tq:///evil.com')).toEqual({
      to: '/',
    })
  })

  it('falls back to the top for an empty input', () => {
    expect(resolveProtocolHandlerTarget('')).toEqual({ to: '/' })
  })
})
