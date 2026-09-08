import { parseJson } from '#lib/local-storage'

// Shown when a push arrives with no usable payload. Swallowing such a push
// silently is not an option: iOS revokes the permission when a push wakes the
// service worker without producing a notification.
const FALLBACK_TITLE = 'tq'

const FALLBACK_URL = '/'

export interface PushNotification {
  title: string
  options: NotificationOptions
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readString(source: unknown, key: string): string | undefined {
  const value = isRecord(source) ? source[key] : undefined
  return typeof value === 'string' && value !== '' ? value : undefined
}

function readPayload(raw: string | undefined): unknown {
  if (raw == null) {
    return undefined
  }

  return parseJson(raw)
    .mapErr((error) => {
      console.error('failed to parse the push payload', error)
    })
    .unwrapOr(undefined)
}

export function parsePushNotification(
  raw: string | undefined,
): PushNotification {
  const payload = readPayload(raw)
  const body = readString(payload, 'body')
  const tag = readString(payload, 'taskId')

  return {
    title: readString(payload, 'title') ?? FALLBACK_TITLE,
    options: {
      ...(body != null && { body }),
      ...(tag != null && { tag }),
      icon: '/icon-192.png',
      data: { url: readString(payload, 'url') ?? FALLBACK_URL },
    },
  }
}

export function readNotificationUrl(data: unknown): string {
  return readString(data, 'url') ?? FALLBACK_URL
}

export type NotificationClickAction<T> =
  | { kind: 'focus'; client: T }
  | { kind: 'navigate'; client: T; url: string }
  | { kind: 'open'; url: string }

export function resolveNotificationClickAction<T extends { url: string }>(
  clients: readonly T[],
  url: string,
): NotificationClickAction<T> {
  const opened = clients.find((client) => client.url === url)
  if (opened) {
    return { kind: 'focus', client: opened }
  }

  const [first] = clients
  if (first) {
    return { kind: 'navigate', client: first, url }
  }

  return { kind: 'open', url }
}
