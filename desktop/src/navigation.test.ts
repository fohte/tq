import { describe, expect, it } from 'vitest'

import {
  classifyNavigation,
  createOnNavigateRequest,
  type NavigationAction,
  resolveDeepLink,
  resolveInternalUrl,
  resolveOpenInMainWindowPath,
  shouldOpenSideNavigationInMain,
  shouldUseNavigationRequest,
} from '#navigation'

const ORIGIN = 'https://tq.example.com'

describe('resolveInternalUrl', () => {
  it.each<[string, string, string, string | undefined]>([
    [
      'internal path',
      '/tasks/42?tab=details',
      ORIGIN,
      `${ORIGIN}/tasks/42?tab=details`,
    ],
    ['protocol-relative external path', '//evil.test/x', ORIGIN, undefined],
    ['invalid configured origin', '/tasks/42', 'https://', undefined],
  ])('%s', (_name, path, origin, expected) => {
    expect(resolveInternalUrl(path, origin)).toBe(expected)
  })
})

describe('resolveOpenInMainWindowPath', () => {
  it.each<[string, unknown, string, string | undefined]>([
    [
      'side window path with search and hash',
      '/tasks/42?tab=activity#comments',
      `${ORIGIN}/?layout=compact`,
      '/tasks/42?tab=activity#comments',
    ],
    [
      'relative memo window path',
      'tasks/42',
      `${ORIGIN}/memo?layout=compact`,
      '/tasks/42',
    ],
    [
      'absolute path at the configured origin',
      `${ORIGIN}/tasks/42?tab=details`,
      `${ORIGIN}/?layout=compact`,
      '/tasks/42?tab=details',
    ],
    [
      'double-slash path at the configured origin',
      `${ORIGIN}//evil.test/x`,
      `${ORIGIN}/?layout=compact`,
      '/evil.test/x',
    ],
    ['non-string path', null, `${ORIGIN}/?layout=compact`, undefined],
    [
      'sender outside the configured origin',
      '/tasks/42',
      'https://login.example.test/',
      undefined,
    ],
    [
      'absolute path at another origin',
      'https://tq.example.com.evil.test/tasks/42',
      `${ORIGIN}/?layout=compact`,
      undefined,
    ],
    [
      'protocol-relative path at another origin',
      '//tq.example.com.evil.test/tasks/42',
      `${ORIGIN}/memo?layout=compact`,
      undefined,
    ],
    ['unparseable path', 'http://[', `${ORIGIN}/?layout=compact`, undefined],
  ])('%s', (_name, path, senderUrl, expected) => {
    expect(resolveOpenInMainWindowPath(path, senderUrl, ORIGIN)).toBe(expected)
  })
})

describe('createOnNavigateRequest', () => {
  it('reports registration while at least one listener remains subscribed', () => {
    const listenerStates: boolean[] = []
    const subscriptions = new Set<(path: unknown) => void>()
    const firstDeliveries: string[] = []
    const secondDeliveries: string[] = []
    const onNavigateRequest = createOnNavigateRequest(
      (listener) => {
        subscriptions.add(listener)
        return () => subscriptions.delete(listener)
      },
      (registered) => listenerStates.push(registered),
    )

    const unsubscribeFirst = onNavigateRequest((path) =>
      firstDeliveries.push(path),
    )
    const unsubscribeSecond = onNavigateRequest((path) =>
      secondDeliveries.push(path),
    )
    for (const listener of subscriptions) listener('/tasks/first')
    unsubscribeFirst()
    unsubscribeFirst()
    for (const listener of subscriptions) listener('/tasks/second')
    unsubscribeSecond()
    unsubscribeSecond()
    for (const listener of subscriptions) listener('/tasks/third')

    const actual = () => [
      listenerStates,
      firstDeliveries,
      secondDeliveries,
      subscriptions.size,
    ]

    expect(actual()).toEqual([
      [true, false],
      ['/tasks/first'],
      ['/tasks/first', '/tasks/second'],
      0,
    ])
  })
})

describe('shouldUseNavigationRequest', () => {
  it.each<[string, boolean, string, boolean, boolean]>([
    [
      'registered listener on loaded tq page',
      true,
      `${ORIGIN}/tasks/1`,
      false,
      true,
    ],
    ['missing listener on tq page', false, `${ORIGIN}/tasks/1`, false, false],
    [
      'registered listener on external page',
      true,
      'https://login.example.test/',
      false,
      false,
    ],
    [
      'registered listener while tq page loads',
      true,
      `${ORIGIN}/tasks/1`,
      true,
      false,
    ],
  ])(
    '%s',
    (_name, listenerRegistered, mainWindowUrl, mainWindowLoading, expected) => {
      expect(
        shouldUseNavigationRequest(
          listenerRegistered,
          mainWindowUrl,
          ORIGIN,
          mainWindowLoading,
        ),
      ).toBe(expected)
    },
  )
})

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

  it('routes internal navigation from the side window to the main window', () => {
    expect(
      classifyNavigation(
        `${ORIGIN}/?layout=compact`,
        `${ORIGIN}/tasks/2`,
        ORIGIN,
        [],
        'side',
      ),
    ).toBe('open-main')
  })

  it('routes internal navigation from the memo window to the main window', () => {
    expect(
      classifyNavigation(
        `${ORIGIN}/memo?layout=compact`,
        `${ORIGIN}/tasks/2`,
        ORIGIN,
        [],
        'memo',
      ),
    ).toBe('open-main')
  })

  it.each(['main', 'side'] as const)(
    'routes the memo path from the %s window to the memo window',
    (source) => {
      expect(
        classifyNavigation(
          `${ORIGIN}/tasks/1`,
          `${ORIGIN}/memo?layout=compact`,
          ORIGIN,
          [],
          source,
        ),
      ).toBe('open-memo')
    },
  )

  it('recognizes a trailing slash on the memo path', () => {
    expect(
      classifyNavigation(
        `${ORIGIN}/tasks/1`,
        `${ORIGIN}/memo/?layout=compact`,
        ORIGIN,
      ),
    ).toBe('open-memo')
  })

  it('leaves side-window query and hash changes on the compact page', () => {
    expect(
      shouldOpenSideNavigationInMain(
        `${ORIGIN}/?layout=compact&filter=today#now`,
        `${ORIGIN}/?layout=compact`,
        ORIGIN,
      ),
    ).toBe(false)
  })

  it('routes side-window links to another tq path to the main window', () => {
    expect(
      shouldOpenSideNavigationInMain(
        `${ORIGIN}/tasks/2`,
        `${ORIGIN}/?layout=compact`,
        ORIGIN,
      ),
    ).toBe(true)
  })

  it('keeps external sign-in redirects in the side window', () => {
    expect(
      classifyNavigation(
        'https://team.access.example/login',
        `${ORIGIN}/auth/callback`,
        ORIGIN,
        [],
        'side',
      ),
    ).toBe('allow')
  })

  it('continues opening external links from the side window in the default browser', () => {
    expect(
      classifyNavigation(
        `${ORIGIN}/?layout=compact`,
        'https://github.com/example/repo',
        ORIGIN,
        [],
        'side',
      ),
    ).toBe('open-external')
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
