import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'

import { type ChangeEvent, subscribeToChangeEvents } from '#lib/change-events'

const HEARTBEAT_INTERVAL_MS = 30_000

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
        await stream.write(': heartbeat\n\n')
        continue
      }

      await stream.writeSSE({ event: 'change', data: JSON.stringify(event) })
    }

    unsubscribe()
    wake()
  }),
)
