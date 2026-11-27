import type { Command } from 'commander'
import { ResultAsync } from 'neverthrow'

import { fetchWithNetworkError, toApiError } from '#client'
import { buildClientConfig } from '#command-context'
import { errorFromCause } from '#errors'
import { fail, tryParseJson } from '#result'

type SseEvent = {
  event: string
  data: string[]
}

const EVENT_STREAM_IDLE_TIMEOUT_MS = 90_000

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

function readChunk(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  abortController: AbortController,
) {
  let timer: ReturnType<typeof setTimeout> | undefined
  const idleTimeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      const timeoutError = new Error('Event stream idle for 90 seconds.')
      abortController.abort(timeoutError)
      reject(timeoutError)
    }, EVENT_STREAM_IDLE_TIMEOUT_MS)
  })

  return ResultAsync.fromPromise(
    Promise.race([reader.read(), idleTimeout]).finally(() => {
      if (timer != null) clearTimeout(timer)
    }),
    errorFromCause,
  )
}

async function readEvents(
  body: ReadableStream<Uint8Array>,
  command: Command,
  abortController: AbortController,
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let event: SseEvent = { event: '', data: [] }

  let done = false
  while (!done) {
    const result = await readChunk(reader, abortController)
    if (result.isErr()) fail(command, result.error)
    const chunk = result.value
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
      const abortController = new AbortController()
      const response = await fetchWithNetworkError(
        config.value.apiUrl,
        fetchImpl,
        url,
        {
          headers: { ...config.value.headers, Accept: 'text/event-stream' },
          signal: abortController.signal,
        },
      )

      if (!response.ok) fail(command, await toApiError(response))
      const mediaType = response.headers
        .get('content-type')
        ?.split(';', 1)[0]
        ?.trim()
        .toLowerCase()
      if (mediaType !== 'text/event-stream') {
        fail(command, new Error('Expected text/event-stream response.'))
      }
      if (response.body == null) {
        fail(command, new Error('Event stream response has no body.'))
      }

      await writeStdoutLine(JSON.stringify({ type: 'connected' }))
      await readEvents(response.body, command, abortController)
      fail(command, new Error('Event stream closed.'))
    })
}
