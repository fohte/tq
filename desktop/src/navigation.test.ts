import { describe, expect, it } from 'vitest'

import { classifyNavigation, type NavigationAction } from '#navigation'

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
