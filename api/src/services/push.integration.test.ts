import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sendNotification } from 'web-push'

import { db } from '#db/connection'
import { pushSubscriptions } from '#db/schema'
import { sendPush } from '#services/push'
import { setupTestDb } from '#testing'

vi.mock('web-push', async (importOriginal) => ({
  ...(await importOriginal<typeof import('web-push')>()),
  sendNotification: vi.fn(),
}))

setupTestDb()

beforeEach(() => {
  vi.mocked(sendNotification).mockReset().mockResolvedValue({
    statusCode: 201,
    body: '',
    headers: {},
  })
})

async function register(endpoint: string, context: 'work' | 'personal') {
  await db.insert(pushSubscriptions).values({
    endpoint,
    p256dh: 'p256dh-key',
    auth: 'auth-secret',
    context,
  })
}

function sentEndpoints() {
  return vi
    .mocked(sendNotification)
    .mock.calls.map(([subscription]) => subscription.endpoint)
    .sort((a, b) => a.localeCompare(b))
}

describe('sendPush', () => {
  it('reaches every device of the targeted context and no other', async () => {
    await register('https://push.example.com/work-laptop', 'work')
    await register('https://push.example.com/work-phone', 'work')
    await register('https://push.example.com/home-laptop', 'personal')

    const report = await sendPush(
      { context: 'work' },
      { title: 'tq', body: 'Standup in 5 minutes' },
    )

    expect(report).toEqual({ sent: 2, removed: 0, failed: 0 })
    expect(sentEndpoints()).toEqual([
      'https://push.example.com/work-laptop',
      'https://push.example.com/work-phone',
    ])
  })
})
