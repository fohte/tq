import { describe, expect, it } from 'vitest'

import { resolveProtocolHandlerTarget } from '#lib/protocol-handler'

describe('resolveProtocolHandlerTarget', () => {
  it('resolves a task link to the task route', () => {
    expect(resolveProtocolHandlerTarget('web+tq://tasks/123')).toEqual({
      to: '/tasks/123',
      search: {},
      hash: '',
    })
  })

  it('resolves a link under a different top-level path', () => {
    expect(resolveProtocolHandlerTarget('web+tq://today')).toEqual({
      to: '/today',
      search: {},
      hash: '',
    })
  })

  it('resolves a deeply nested path with multiple segments', () => {
    expect(
      resolveProtocolHandlerTarget('web+tq://tasks/123/pages/456'),
    ).toEqual({
      to: '/tasks/123/pages/456',
      search: {},
      hash: '',
    })
  })

  it('resolves the bare scheme to the app root', () => {
    expect(resolveProtocolHandlerTarget('web+tq://')).toEqual({
      to: '/',
      search: {},
      hash: '',
    })
  })

  it('carries the query string through as search params', () => {
    expect(
      resolveProtocolHandlerTarget('web+tq://tasks?q=status%3Atodo'),
    ).toEqual({
      to: '/tasks',
      search: { q: 'status:todo' },
      hash: '',
    })
  })

  it('carries the fragment through as hash', () => {
    expect(resolveProtocolHandlerTarget('web+tq://tasks/123#comments')).toEqual(
      {
        to: '/tasks/123',
        search: {},
        hash: 'comments',
      },
    )
  })

  it('falls back to the top for a non-web+tq protocol', () => {
    expect(resolveProtocolHandlerTarget('https://tasks/123')).toEqual({
      to: '/',
      search: {},
      hash: '',
    })
  })

  it('falls back to the top for a triple-slash open-redirect attempt', () => {
    expect(resolveProtocolHandlerTarget('web+tq:///evil.com')).toEqual({
      to: '/',
      search: {},
      hash: '',
    })
  })

  it('falls back to the top for an empty input', () => {
    expect(resolveProtocolHandlerTarget('')).toEqual({
      to: '/',
      search: {},
      hash: '',
    })
  })
})
