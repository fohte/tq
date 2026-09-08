import { describe, expect, it } from 'vitest'

import {
  parsePushNotification,
  readNotificationUrl,
  resolveNotificationClickAction,
} from '#lib/push-notification'

describe('parsePushNotification', () => {
  it('builds a notification from the payload the api sends', () => {
    expect(
      parsePushNotification(
        JSON.stringify({
          title: 'デプロイ手順を書く',
          body: '10:00 に通知',
          taskId: '0f8b1f6c-1d3a-4c58-9a2e-7b6c5d4e3f21',
          url: 'https://tasks.example.com/tasks/42',
        }),
      ),
    ).toEqual({
      title: 'デプロイ手順を書く',
      options: {
        body: '10:00 に通知',
        tag: '0f8b1f6c-1d3a-4c58-9a2e-7b6c5d4e3f21',
        icon: '/icon-192.png',
        data: { url: 'https://tasks.example.com/tasks/42' },
      },
    })
  })

  it('falls back to the app name and root url when the payload is unusable', () => {
    expect(parsePushNotification('not json')).toEqual({
      title: 'tq',
      options: {
        icon: '/icon-192.png',
        data: { url: '/' },
      },
    })
  })

  it('falls back the same way when the push carries no payload at all', () => {
    expect(parsePushNotification(undefined)).toEqual({
      title: 'tq',
      options: {
        icon: '/icon-192.png',
        data: { url: '/' },
      },
    })
  })
})

describe('readNotificationUrl', () => {
  it('reads back the url stored on the notification', () => {
    expect(
      readNotificationUrl({ url: 'https://tasks.example.com/tasks/42' }),
    ).toEqual('https://tasks.example.com/tasks/42')
  })

  it('falls back to the root url when the notification carries no url', () => {
    expect(readNotificationUrl(undefined)).toEqual('/')
  })
})

describe('resolveNotificationClickAction', () => {
  const url = 'https://tasks.example.com/tasks/42'

  it('focuses the client already showing the target url', () => {
    const opened = { url }

    expect(
      resolveNotificationClickAction(
        [{ url: 'https://tasks.example.com/today' }, opened],
        url,
      ),
    ).toEqual({ kind: 'focus', client: opened })
  })

  it('navigates the first open client when none shows the target url', () => {
    const first = { url: 'https://tasks.example.com/today' }

    expect(
      resolveNotificationClickAction(
        [first, { url: 'https://tasks.example.com/inbox' }],
        url,
      ),
    ).toEqual({ kind: 'navigate', client: first, url })
  })

  it('opens a window when no client is open', () => {
    expect(resolveNotificationClickAction([], url)).toEqual({
      kind: 'open',
      url,
    })
  })
})
