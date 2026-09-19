import { describe, expect, it } from 'vitest'

import {
  classifyNavigation,
  type NavigationAction,
  resolveDeepLink,
} from '#navigation'

const ORIGIN = 'https://tq.example.com'

describe('classifyNavigation', () => {
  describe('from a tq page', () => {
    it.each<[string, NavigationAction, string]>([
      ['same origin', 'allow', `${ORIGIN}/tasks/2`],
      ['other site', 'open-external', 'https://github.com/example/repo'],
      [
        'host that only starts with the origin',
        'open-external',
        'https://tq.example.com.evil.test/',
      ],
      ['other port', 'open-external', 'https://tq.example.com:8443/'],
      ['other scheme', 'open-external', 'http://tq.example.com/'],
      ['mailto', 'open-external', 'mailto:someone@example.com'],
      ['scheme not on the allowlist', 'deny', 'example-app://open'],
      ['file scheme', 'deny', 'file:///etc/hosts'],
      ['unparsable url', 'deny', 'not a url'],
    ])('%s -> %s', (_name, expected, targetUrl) => {
      expect(classifyNavigation(`${ORIGIN}/tasks/1`, targetUrl, ORIGIN)).toBe(
        expected,
      )
    })
  })

  it.each<[string, NavigationAction, string]>([
    ['scheme on the allowlist', 'open-external', 'example-app://open'],
    ['scheme not on the allowlist', 'deny', 'other-app://open'],
    ['file scheme, never allowlisted by default', 'deny', 'file:///etc/hosts'],
  ])('with allowed schemes: %s -> %s', (_name, expected, targetUrl) => {
    expect(
      classifyNavigation(`${ORIGIN}/tasks/1`, targetUrl, ORIGIN, [
        'example-app',
      ]),
    ).toBe(expected)
  })

  it.each<[string, NavigationAction, string]>([
    ['same origin', 'allow', `${ORIGIN}/tasks/2`],
    ['other site', 'open-external', 'https://github.com/example/repo'],
  ])(
    'ignores the path of a configured origin with a trailing slash: %s -> %s',
    (_name, expected, targetUrl) => {
      expect(
        classifyNavigation(`${ORIGIN}/tasks/1`, targetUrl, `${ORIGIN}/`),
      ).toBe(expected)
    },
  )

  it('leaves navigation from a page outside tq alone so sign-in can complete', () => {
    expect(
      classifyNavigation(
        'https://team.access.example/login',
        'https://idp.example.org/authorize',
        ORIGIN,
      ),
    ).toBe('allow')
  })
})

describe('resolveDeepLink', () => {
  it.each<[string, string, string | undefined]>([
    [
      'same host and path',
      'tq://tq.example.com/tasks/1?tab=a#b',
      `${ORIGIN}/tasks/1?tab=a#b`,
    ],
    ['host only', 'tq://tq.example.com', `${ORIGIN}/`],
    [
      'host in a different case',
      'tq://TQ.EXAMPLE.COM/tasks/1',
      `${ORIGIN}/tasks/1`,
    ],
    [
      'host that only starts with the origin host',
      'tq://tq.example.com.evil.test/',
      undefined,
    ],
    ['other host', 'tq://evil.test/tasks/1', undefined],
    ['other port', 'tq://tq.example.com:8443/', undefined],
    [
      'origin host as userinfo of another host',
      'tq://tq.example.com@evil.test/',
      undefined,
    ],
    ['https scheme', `${ORIGIN}/tasks/1`, undefined],
    ['other scheme', 'example-app://tq.example.com/tasks/1', undefined],
    ['unparsable url', 'not a url', undefined],
  ])('%s: %s -> %s', (_name, deepLink, expected) => {
    expect(resolveDeepLink(deepLink, ORIGIN)).toBe(expected)
  })

  it('keeps the scheme of an http origin', () => {
    expect(
      resolveDeepLink('tq://localhost:3000/tasks/1', 'http://localhost:3000'),
    ).toBe('http://localhost:3000/tasks/1')
  })
})
