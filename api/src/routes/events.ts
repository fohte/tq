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
      wakeListener?.()
      wakeListener = null
    }
    const unsubscribe = subscribeToChangeEvents((event) => {
      pending.push(event)
      wake()
    })

    stream.onAbort(() => {
      unsubscribe()
      wake()
    })

    const isAborted = () => stream.aborted
    const takeNextEvent = () => pending.shift()

    while (!isAborted()) {
      if (pending.length === 0) {
        let wake!: () => void
        const waiting = new Promise<void>((resolve) => {
          wake = resolve
        })
        wakeListener = wake
        const timer = setTimeout(wake, HEARTBEAT_INTERVAL_MS)
        heartbeatTimer = timer
        await waiting

        clearTimeout(timer)
        wakeListener = null
        heartbeatTimer = null
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
  }),
)
