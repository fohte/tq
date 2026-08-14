import { describe, expect, it } from 'vitest'

import { extractAppResourceRefs } from '#lib/app-url'

const APP_DOMAIN = 'tq.fohte.net'

describe('extractAppResourceRefs', () => {
  it('extracts a numeric ref from an https URL, tagged with its resource', () => {
    expect(
      extractAppResourceRefs(
        `see https://${APP_DOMAIN}/tasks/123 for context`,
        APP_DOMAIN,
        'tasks',
      ),
    ).toEqual([{ resource: 'tasks', kind: 'number', value: 123 }])
  })

  it('extracts a uuid ref from an http URL', () => {
    const uuid = '9b1f6f0e-1c0a-4e8b-9c7a-2b6b2b6b2b6b'
    expect(
      extractAppResourceRefs(
        `http://${APP_DOMAIN}/tasks/${uuid}`,
        APP_DOMAIN,
        'tasks',
      ),
    ).toEqual([{ resource: 'tasks', kind: 'id', value: uuid }])
  })

  it('dedupes repeated refs to the same resource', () => {
    expect(
      extractAppResourceRefs(
        `https://${APP_DOMAIN}/tasks/123 again, see https://${APP_DOMAIN}/tasks/123`,
        APP_DOMAIN,
        'tasks',
      ),
    ).toEqual([{ resource: 'tasks', kind: 'number', value: 123 }])
  })

  it('returns an empty array when there are no matching URLs', () => {
    expect(
      extractAppResourceRefs('no references here', APP_DOMAIN, 'tasks'),
    ).toEqual([])
  })

  it('ignores a URL for a different resource', () => {
    expect(
      extractAppResourceRefs(
        `https://${APP_DOMAIN}/projects/123`,
        APP_DOMAIN,
        'tasks',
      ),
    ).toEqual([])
  })

  it('ignores a URL for a different domain', () => {
    expect(
      extractAppResourceRefs(
        'https://example.com/tasks/123',
        APP_DOMAIN,
        'tasks',
      ),
    ).toEqual([])
  })

  it('stops the ref at a trailing path segment', () => {
    expect(
      extractAppResourceRefs(
        `https://${APP_DOMAIN}/tasks/123/pages/abc`,
        APP_DOMAIN,
        'tasks',
      ),
    ).toEqual([{ resource: 'tasks', kind: 'number', value: 123 }])
  })

  it('stops the ref before trailing sentence punctuation', () => {
    expect(
      extractAppResourceRefs(
        `see https://${APP_DOMAIN}/tasks/123.`,
        APP_DOMAIN,
        'tasks',
      ),
    ).toEqual([{ resource: 'tasks', kind: 'number', value: 123 }])
  })

  it('stops the ref before a query string', () => {
    expect(
      extractAppResourceRefs(
        `https://${APP_DOMAIN}/tasks/123?foo=bar`,
        APP_DOMAIN,
        'tasks',
      ),
    ).toEqual([{ resource: 'tasks', kind: 'number', value: 123 }])
  })
})
