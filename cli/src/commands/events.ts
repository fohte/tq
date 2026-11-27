import type { Command } from 'commander'

import { fetchWithNetworkError, toApiError } from '#client'
import { buildClientConfig } from '#command-context'
import { fail, tryParseJson } from '#result'

type SseEvent = {
  event: string
  data: string[]
}

function writeStdoutLine(line: string): Promise<void> {
  return new Promise((resolve) => {
    if (process.stdout.write(`${line}\n`)) resolve()
    else process.stdout.once('drain', resolve)
  })
}

async function dispatchEvent(event: SseEvent, command: Command): Promise<void> {
  if (event.event !== 'change' || event.data.length === 0) return

  const data = event.data.join('\n')
  const parsed = tryParseJson(data)
  if (parsed.isErr()) fail(command, new Error('Invalid JSON in change event.'))
  await writeStdoutLine(JSON.stringify(parsed.value))
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
        await dispatchEvent(event, command)
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
    .description('Stream change events as NDJSON after a connected marker')
    .action(async (_options: unknown, command: Command) => {
      const config = buildClientConfig(command)
      if (config.isErr()) fail(command, config.error)

      const url = `${config.value.apiUrl.replace(/\/+$/, '')}/api/events`
      const response = await fetchWithNetworkError(
        config.value.apiUrl,
        fetchImpl,
        url,
        { headers: { ...config.value.headers, Accept: 'text/event-stream' } },
      )

      if (!response.ok) fail(command, await toApiError(response))
      if (response.body == null) {
        fail(command, new Error('Event stream response has no body.'))
      }

      await writeStdoutLine(JSON.stringify({ type: 'connected' }))
      await readEvents(response.body, command)
      fail(command, new Error('Event stream closed.'))
    })
}
