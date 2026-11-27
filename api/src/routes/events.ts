import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'

import { type ChangeEvent, subscribeToChangeEvents } from '#lib/change-events'

const HEARTBEAT_INTERVAL_MS = 30_000
const MAX_PENDING_EVENTS = 100

export const eventsApp = new Hono().get('/events', (c) =>
  streamSSE(c, async (stream) => {
    const pending: ChangeEvent[] = []
    let wakeListener: (() => void) | null = null
    let heartbeatTimer: ReturnType<typeof setTimeout> | null = null

    const wake = () => {
      if (heartbeatTimer != null) {
        clearTimeout(heartbeatTimer)
        heartbeatTimer = null
      }
      const resolveWait = wakeListener
      wakeListener = null
      resolveWait?.()
    }
    const unsubscribe = subscribeToChangeEvents((event) => {
      // 遅い購読者は再接続後に全件を取り直すため、キューが上限を超えたら切断する。
      if (pending.length >= MAX_PENDING_EVENTS) {
        stream.abort()
        return
      }
      pending.push(event)
      wake()
    })

    stream.onAbort(wake)

    const isAborted = () => stream.aborted
    const takeNextEvent = () => pending.shift()

    while (!isAborted()) {
      if (pending.length === 0) {
        const waiting = new Promise<void>((resolve) => {
          wakeListener = resolve
        })
        heartbeatTimer = setTimeout(wake, HEARTBEAT_INTERVAL_MS)
        await waiting

        if (isAborted()) break
      }

      const event = takeNextEvent()
      if (event == null) {
        await stream.writeSSE({ event: 'heartbeat', data: '' })
        continue
      }

      await stream.writeSSE({ event: 'change', data: JSON.stringify(event) })
    }

    unsubscribe()
    wake()
  }),
)
