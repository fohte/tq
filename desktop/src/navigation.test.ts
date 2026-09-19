import { describe, expect, it } from 'vitest'

import { classifyNavigation, type NavigationAction } from '#navigation'

const ORIGIN = 'https://tq.example.com'

describe('classifyNavigation', () => {
  describe('from a tq page', () => {
    it.each<[string, string, NavigationAction]>([
      ['same origin', `${ORIGIN}/tasks/2`, 'allow'],
      ['other site', 'https://github.com/example/repo', 'open-external'],
      [
        'host that only starts with the origin',
        'https://tq.example.com.evil.test/',
        'open-external',
      ],
      ['other port', 'https://tq.example.com:8443/', 'open-external'],
      ['other scheme', 'http://tq.example.com/', 'open-external'],
      ['unregistered scheme', 'example-app://open', 'deny'],
      ['file scheme', 'file:///etc/hosts', 'deny'],
      ['unparsable url', 'not a url', 'deny'],
    ])('%s -> %s', (_name, targetUrl, expected) => {
      expect(classifyNavigation(`${ORIGIN}/tasks/1`, targetUrl, ORIGIN)).toBe(
        expected,
      )
    })
  })

  it.each<[string, NavigationAction]>([
    [`${ORIGIN}/tasks/2`, 'allow'],
    ['https://github.com/example/repo', 'open-external'],
  ])(
    'ignores the path of a configured origin with a trailing slash: %s -> %s',
    (targetUrl, expected) => {
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
