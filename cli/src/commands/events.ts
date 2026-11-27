import type { Command } from 'commander'

import { toApiError } from '#client'
import { buildClientConfig } from '#command-context'
import { NetworkError } from '#errors'
import { fail, tryParseJson } from '#result'

type SseEvent = {
  event: string
  data: string[]
}

function dispatchEvent(event: SseEvent, command: Command): void {
  if (event.event !== 'change' || event.data.length === 0) return

  const data = event.data.join('\n')
  tryParseJson(data).match(
    (value) => process.stdout.write(`${JSON.stringify(value)}\n`),
    () => fail(command, new Error('Invalid JSON in change event.')),
  )
}

async function readEvents(
  body: ReadableStream<Uint8Array>,
  command: Command,
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let event: SseEvent = { event: '', data: [] }

  let done = false
  while (!done) {
    const chunk = await reader.read()
    buffer += decoder.decode(chunk.value, { stream: !chunk.done })

    let newline = buffer.indexOf('\n')
    while (newline !== -1) {
      const line = buffer.slice(0, newline).replace(/\r$/, '')
      buffer = buffer.slice(newline + 1)

      if (line.length === 0) {
        dispatchEvent(event, command)
        event = { event: '', data: [] }
      } else if (!line.startsWith(':')) {
        const separator = line.indexOf(':')
        const field = separator === -1 ? line : line.slice(0, separator)
        const value =
          separator === -1 ? '' : line.slice(separator + 1).replace(/^ /, '')
        if (field === 'event') event.event = value
        if (field === 'data') event.data.push(value)
      }

      newline = buffer.indexOf('\n')
    }

    done = chunk.done
  }
}

export function registerEventsCommand(
  program: Command,
  fetchImpl: typeof fetch,
): void {
  program
    .command('events')
    .description('Stream task change events as newline-delimited JSON')
    .action(async (_options: unknown, command: Command) => {
      const config = buildClientConfig(command)
      if (config.isErr()) fail(command, config.error)

      const url = `${config.value.apiUrl.replace(/\/+$/, '')}/api/events`
      const response = await fetchImpl(url, {
        headers: { ...config.value.headers, Accept: 'text/event-stream' },
      }).catch((cause: unknown) =>
        Promise.reject(
          new NetworkError(`Failed to reach ${config.value.apiUrl}`, cause),
        ),
      )

      if (!response.ok) fail(command, await toApiError(response))
      if (response.body == null) {
        fail(command, new Error('Event stream response has no body.'))
      }

      process.stdout.write(`${JSON.stringify({ type: 'connected' })}\n`)
      await readEvents(response.body, command)
      fail(command, new Error('Event stream closed.'))
    })
}
